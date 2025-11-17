import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class ActivateVoucher {
  private logger = new Logger(ActivateVoucher.name);

  constructor(private prisma: PrismaService) {}

  async execute(voucherId: string, amount: number, pointsCost: number) {
    try {
      this.logger.log(
        `[START] Activating voucher ${voucherId} with amount: ${amount}, pointsCost: ${pointsCost}`,
      );

      // 1. ตรวจสอบว่า voucher upstream มีอยู่จริง
      this.logger.log(`[STEP 1] Finding upcoming voucher ${voucherId}`);
      const upcomingVoucher = await this.prisma.voucher.findUnique({
        where: { id: voucherId },
        include: {
          _count: {
            select: { voucherCodes: true },
          },
        },
      });

      this.logger.log(
        `[STEP 1] Found voucher: ${JSON.stringify({ id: upcomingVoucher?.id, status: upcomingVoucher?.status, totalIssued: upcomingVoucher?.totalIssued, codesCount: upcomingVoucher?._count.voucherCodes })}`,
      );

      if (!upcomingVoucher) {
        this.logger.error(`[ERROR] Voucher ${voucherId} not found`);
        throw new NotFoundException(`Voucher with ID ${voucherId} not found`);
      }

      // 2. นับจำนวน codes ที่มีอยู่แล้ว (codes ที่มี voucherGroupId)
      this.logger.log(`[STEP 2] Counting existing codes`);
      const activeCodesCount = await this.prisma.voucherCode.count({
        where: { voucherId, voucherGroupId: { not: null } },
      });

      this.logger.log(
        `[STEP 2] Current state: ${activeCodesCount} active codes, ${upcomingVoucher.totalIssued} remaining (upcoming)`,
      );

      // 3. ตรวจสอบว่า amount ไม่เกิน totalIssued ที่เหลือ
      this.logger.log(
        `[STEP 3] Validating amount ${amount} <= remaining totalIssued ${upcomingVoucher.totalIssued}`,
      );

      if (amount > upcomingVoucher.totalIssued) {
        this.logger.error(
          `[ERROR] Amount ${amount} exceeds remaining totalIssued ${upcomingVoucher.totalIssued}`,
        );
        throw new BadRequestException(
          `Cannot activate ${amount} codes. Only ${upcomingVoucher.totalIssued} remaining to be activated.`,
        );
      }

      // 4. ใช้ transaction เพื่อสร้าง codes และอัพเดท isActive
      this.logger.log(`[STEP 4] Starting transaction`);
      const result = await this.prisma.$transaction(async (tx) => {
        // 4.1 นับจำนวน codes ที่มีอยู่แล้วเพื่อเป็น starting number
        const existingCodesCount = await tx.voucherCode.count({
          where: { voucherId },
        });

        // 4.2 สร้าง sequential codes: voucherId-0001, voucherId-0002, ...
        this.logger.log(
          `[STEP 4.1] Generating ${amount} sequential codes starting from ${existingCodesCount + 1}`,
        );
        const codes: string[] = [];
        for (let i = 1; i <= amount; i++) {
          const sequenceNumber = existingCodesCount + i;
          const code = `${voucherId}-${sequenceNumber.toString().padStart(4, '0')}`;
          codes.push(code);
        }

        // 4.3 implement code smart contract here trigger (future)

        // 4.4 เพิ่ม codes ลง database พร้อม voucherGroupId
        this.logger.log(`[STEP 4.2] Creating ${amount} active voucher codes`);
        const now = new Date();
        const voucherGroupId = `${voucherId}-${now.getTime()}`;
        await tx.voucherCode.createMany({
          data: codes.map((code) => ({
            code,
            voucherId,
            pointsCost,
            voucherGroupId,
            createdAt: now,
          })),
        });

        this.logger.log(
          `[STEP 4.2] Created ${amount} active codes successfully`,
        );

        // 4.4 ลด totalIssued ของ voucher
        const newTotalIssued = upcomingVoucher.totalIssued - amount;
        this.logger.log(
          `[STEP 4.3] Updating voucher: totalIssued ${upcomingVoucher.totalIssued} -> ${newTotalIssued}`,
        );

        await tx.voucher.update({
          where: { id: voucherId },
          data: {
            totalIssued: newTotalIssued,
          },
        });

        // 4.5 นับจำนวน codes ตามสถานะ (codes ที่มี voucherGroupId)
        const activeCodesCount = await tx.voucherCode.count({
          where: { voucherId, voucherGroupId: { not: null } },
        });

        this.logger.log(
          `[STEP 4.4] Active codes: ${activeCodesCount}, Upcoming: ${newTotalIssued}`,
        );

        return {
          voucherId,
          codesCreated: amount,
          activeCodesCount,
          upcomingCodesCount: newTotalIssued,
        };
      });

      this.logger.log(
        `[SUCCESS] Activated ${amount} codes for voucher ${voucherId}. Active: ${result.activeCodesCount}, Upcoming: ${result.upcomingCodesCount}`,
      );

      return {
        success: true,
        message: `Activated ${amount} codes successfully. Active: ${result.activeCodesCount}, Upcoming: ${result.upcomingCodesCount}`,
        voucherId: result.voucherId,
        codesCreated: result.codesCreated,
        activeCodesCount: result.activeCodesCount,
        upcomingCodesCount: result.upcomingCodesCount,
        pointsCost,
      };
    } catch (error) {
      this.logger.error(
        `[FATAL ERROR] Failed to activate voucher: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
