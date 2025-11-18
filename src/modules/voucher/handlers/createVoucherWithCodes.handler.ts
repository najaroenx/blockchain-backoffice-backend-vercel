import {
  Injectable,
  InternalServerErrorException,
  Logger,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { CreateVoucherDto } from '../dtos/voucher.dto';
import { randomUUID } from 'crypto';

@Injectable()
export class CreateVoucherWithCodes {
  private logger = new Logger(CreateVoucherWithCodes.name);

  constructor(private prisma: PrismaService) {}

  async execute(data: CreateVoucherDto) {
    try {
      // Validate Point exists and belongs to merchant
      this.logger.log(`[STEP 0] Validating point ${data.pointId}`);
      const point = await this.prisma.point.findUnique({
        where: { id: data.pointId },
        select: { id: true, symbol: true, merchantId: true, name: true },
      });

      if (!point) {
        this.logger.error(`[ERROR] Point ${data.pointId} not found`);
        throw new ConflictException(`Point with ID ${data.pointId} not found`);
      }

      if (data.merchantId && point.merchantId !== data.merchantId) {
        this.logger.error(
          `[ERROR] Point belongs to different merchant. Point merchantId: ${point.merchantId}, Voucher merchantId: ${data.merchantId}`,
        );
        throw new ConflictException(`Point does not belong to this merchant`);
      }

      this.logger.log(
        `[STEP 0] Point validated ✓ (${point.name}, symbol: ${point.symbol})`,
      );

      // สร้างเฉพาะ voucher metadata (ไม่สร้าง codes)
      const result = await this.prisma.$transaction(async (tx) => {
        // 1. แยก pointsCost, pointId และ dates ออกจาก voucherData
        const { pointsCost, pointId, startDate, endDate, ...voucherData } =
          data;

        // 2. Generate coupon ID
        const couponId = `COUPON-${randomUUID()}`;

        // 3. สร้าง voucher (metadata เท่านั้น)
        const voucher = await tx.voucher.create({
          data: {
            id: couponId,
            ...voucherData,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
          },
        });

        // implement mint coupon

        // implement mint thbs

        // implement tranferfrom to vault

        this.logger.log(`Created voucher metadata ${voucher.id}`);

        return { voucher, pointsCost, pointId };
      });

      this.logger.log(
        `Created voucher ${result.voucher.id} (metadata only, no codes created yet)`,
      );

      return {
        success: true,
        voucher: result.voucher,
        pointsCost: result.pointsCost,
        pointId: result.pointId,
        pointSymbol: point.symbol,
        message: `Voucher created successfully. Use activate endpoint with pointId="${result.pointId}" and currency="${point.symbol}" to create ${data.totalIssued} codes.`,
        note: 'Voucher codes will be created when activating the voucher',
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
