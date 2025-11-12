import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { VoucherStatus } from '@prisma/client';

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

      if (upcomingVoucher.status !== VoucherStatus.upcoming) {
        this.logger.error(
          `[ERROR] Voucher status is ${upcomingVoucher.status}, not upcoming`,
        );
        throw new BadRequestException(
          `Voucher must be in "upcoming" status to activate. Current status: ${upcomingVoucher.status}`,
        );
      }

      // 2. ตรวจสอบว่า amount ไม่เกิน totalIssued
      this.logger.log(
        `[STEP 2] Validating amount ${amount} <= totalIssued ${upcomingVoucher.totalIssued}`,
      );
      if (amount > upcomingVoucher.totalIssued) {
        this.logger.error(
          `[ERROR] Amount ${amount} exceeds totalIssued ${upcomingVoucher.totalIssued}`,
        );
        throw new BadRequestException(
          `Amount (${amount}) cannot exceed totalIssued (${upcomingVoucher.totalIssued})`,
        );
      }

      // 3. ตรวจสอบจำนวน codes ที่มีอยู่
      const existingCodesCount = upcomingVoucher._count.voucherCodes;
      this.logger.log(
        `[STEP 3] Existing codes count: ${existingCodesCount}, requested: ${amount}`,
      );

      if (amount > existingCodesCount) {
        this.logger.error(
          `[ERROR] Not enough codes. Have ${existingCodesCount}, need ${amount}`,
        );
        throw new BadRequestException(
          `Cannot activate ${amount} codes. Only ${existingCodesCount} codes available. Please create codes first or reduce amount.`,
        );
      }

      // 4. ใช้ transaction เพื่อสร้าง voucher ใหม่และย้าย codes
      this.logger.log(`[STEP 4] Starting transaction`);
      const result = await this.prisma.$transaction(async (tx) => {
        // 4.1 สร้าง voucher ใหม่ที่เป็น active
        this.logger.log(`[STEP 4.1] Preparing active voucher data`);

        // Generate ID สำหรับ active voucher ใหม่
        const { randomUUID } = await import('crypto');
        const activeVoucherId = `COUPON-${randomUUID()}`;

        const activeVoucherData: any = {
          id: activeVoucherId,
          name: upcomingVoucher.name,
          description: upcomingVoucher.description,
          status: VoucherStatus.active,
          merchantName: upcomingVoucher.merchantName,
          valueType: upcomingVoucher.valueType,
          value: upcomingVoucher.value,
          startDate: upcomingVoucher.startDate,
          endDate: upcomingVoucher.endDate,
          totalIssued: amount,
          totalRedeemed: 0,
        };

        // เพิ่ม optional fields
        if (upcomingVoucher.merchantId) {
          activeVoucherData.merchantId = upcomingVoucher.merchantId;
        }
        if (upcomingVoucher.currency) {
          activeVoucherData.currency = upcomingVoucher.currency;
        }
        if (upcomingVoucher.imageUrl) {
          activeVoucherData.imageUrl = upcomingVoucher.imageUrl;
        }
        if (upcomingVoucher.limitPerMember) {
          activeVoucherData.limitPerMember = upcomingVoucher.limitPerMember;
        }

        this.logger.log(
          `[STEP 4.1] Creating active voucher with data: ${JSON.stringify(activeVoucherData)}`,
        );

        const activeVoucher = await tx.voucher.create({
          data: activeVoucherData,
        });

        this.logger.log(
          `[STEP 4.1] Created active voucher ${activeVoucher.id}`,
        );

        // 4.2 หา codes จาก upcoming voucher จำนวน amount
        this.logger.log(
          `[STEP 4.2] Finding ${amount} codes from voucher ${voucherId}`,
        );
        const codesToMove = await tx.voucherCode.findMany({
          where: { voucherId },
          take: amount,
          select: { id: true },
        });

        this.logger.log(`[STEP 4.2] Found ${codesToMove.length} codes to move`);

        if (codesToMove.length < amount) {
          this.logger.error(
            `[ERROR] Not enough codes to move. Found ${codesToMove.length}, need ${amount}`,
          );
          throw new BadRequestException(
            `Not enough codes to move. Found ${codesToMove.length}, need ${amount}`,
          );
        }

        // 4.3 ย้าย codes ไปยัง voucher ใหม่และอัพเดท pointsCost
        this.logger.log(
          `[STEP 4.3] Moving codes to active voucher ${activeVoucher.id}`,
        );
        const moveResult = await tx.voucherCode.updateMany({
          where: {
            id: {
              in: codesToMove.map((c) => c.id),
            },
          },
          data: {
            voucherId: activeVoucher.id,
            pointsCost,
          },
        });

        this.logger.log(
          `[STEP 4.3] Moved ${moveResult.count} codes successfully`,
        );

        // 4.4 อัพเดท totalIssued ของ upcoming voucher
        const remainingCodes = existingCodesCount - amount;
        this.logger.log(
          `[STEP 4.4] Updating upcoming voucher totalIssued to ${remainingCodes}`,
        );
        await tx.voucher.update({
          where: { id: voucherId },
          data: {
            totalIssued: remainingCodes,
          },
        });

        this.logger.log(
          `[STEP 4.4] Updated upcoming voucher totalIssued successfully`,
        );

        // 4.5 ดึงข้อมูล upcoming voucher ที่อัพเดทแล้ว
        this.logger.log(`[STEP 4.5] Fetching updated upcoming voucher`);
        const updatedUpcomingVoucher = await tx.voucher.findUnique({
          where: { id: voucherId },
        });

        return {
          activeVoucher,
          upcomingVoucher: updatedUpcomingVoucher,
          codesMoved: moveResult.count,
        };
      });

      this.logger.log(
        `[SUCCESS] Activated ${amount} codes: Created active voucher ${result.activeVoucher.id}, ${existingCodesCount - amount} codes remaining in upcoming voucher ${voucherId}`,
      );

      return {
        success: true,
        message: `Created active voucher with ${amount} codes. ${existingCodesCount - amount} codes remaining as upcoming.`,
        activeVoucher: result.activeVoucher,
        upcomingVoucher: result.upcomingVoucher,
        codesMoved: result.codesMoved,
        activeCodesCount: amount,
        upcomingCodesCount: existingCodesCount - amount,
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
