import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { CreateVoucherDto } from '../dtos/voucher.dto';
import { generateUniqueCodes } from '../utils/generate-codes.util';

@Injectable()
export class CreateVoucherWithCodes {
  private logger = new Logger(CreateVoucherWithCodes.name);

  constructor(private prisma: PrismaService) {}

  async execute(data: CreateVoucherDto) {
    try {
      // สร้าง voucher พร้อม codes ในครั้งเดียว
      const result = await this.prisma.$transaction(async (tx) => {
        // 1. สร้าง voucher
        const voucher = await tx.voucher.create({
          data: {
            ...data,
            startDate: new Date(data.startDate),
            endDate: new Date(data.endDate),
          },
        });

        // 2. สร้าง unique codes (จำนวนเท่ากับ totalIssued)
        const codes = generateUniqueCodes(voucher.id, data.totalIssued);
        
        // 3. implement code smart contract here trigger

        // 4. เพิ่ม codes ลง database
        await tx.voucherCode.createMany({
          data: codes.map((code) => ({
            code,
            voucherId: voucher.id,
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
