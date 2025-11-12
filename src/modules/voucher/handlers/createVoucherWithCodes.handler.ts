import {
  Injectable,
  InternalServerErrorException,
  Logger,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { CreateVoucherDto } from '../dtos/voucher.dto';
import { generateUniqueCodes } from '../utils/generate-codes.util';
import { randomUUID } from 'crypto';

@Injectable()
export class CreateVoucherWithCodes {
  private logger = new Logger(CreateVoucherWithCodes.name);

  constructor(private prisma: PrismaService) {}

  async execute(data: CreateVoucherDto) {
    try {
      // สร้าง voucher พร้อม codes ในครั้งเดียว
      const result = await this.prisma.$transaction(async (tx) => {
        // 1. แยก pointsCost และ dates ออกจาก voucherData
        const { pointsCost, startDate, endDate, ...voucherData } = data;

        // 2. Generate coupon ID
        const couponId = `COUPON-${randomUUID()}`;

        // 3. สร้าง voucher (ไม่รวม pointsCost และแปลง dates)
        const voucher = await tx.voucher.create({
          data: {
            id: couponId,
            ...voucherData,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
          },
        });

        // 4. สร้าง unique codes (จำนวนเท่ากับ totalIssued)
        const codes = generateUniqueCodes(voucher.id, data.totalIssued);

        // 5. implement code smart contract here trigger

        // 6. เพิ่ม codes ลง database พร้อม pointsCost
        await tx.voucherCode.createMany({
          data: codes.map((code) => ({
            code,
            voucherId: voucher.id,
            pointsCost, // ใช้ pointsCost จาก data
          })),
        });

        return voucher;
      });

      this.logger.log(
        `Created voucher ${result.id} with ${data.totalIssued} unique codes`,
      );

      return {
        success: true,
        voucher: result,
        message: `Voucher created with ${data.totalIssued} unique redeem codes`,
      };
    } catch (error) {
      this.logger.error(
        `Error creating voucher: ${error.message}`,
        error.stack,
      );

      // ตรวจสอบว่าเป็น duplicate key error หรือไม่
      if (error.code === 'P2002' && error.meta?.target?.includes('id')) {
        throw new ConflictException('Duplicate coupon ID');
      }

      throw new InternalServerErrorException('Failed to create voucher');
    }
  }

  /**
   * ดึง codes ที่ยังไม่ได้ใช้ของ voucher
   */
  async getAvailableCodes(voucherId: string, limit: number = 10) {
    return this.prisma.voucherCode.findMany({
      where: {
        voucherId,
        isUsed: false,
      },
      take: limit,
      select: {
        code: true,
      },
    });
  }

  /**
   * Export codes ทั้งหมดของ voucher
   */
  async exportAllCodes(voucherId: string) {
    return this.prisma.voucherCode.findMany({
      where: { voucherId },
      select: {
        code: true,
        isUsed: true,
        usedBy: true,
        usedAt: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }
}
