import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';

export interface UpdateVoucherCodesPointCostInput {
  voucherId: string;
  amount: number; // จำนวน codes ที่จะอัปเดต
  price: number; // pointsCost ใหม่
}

@Injectable()
export class ManageCouponHandler {
  private readonly logger = new Logger(ManageCouponHandler.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * อัปเดต pointsCost ของ VoucherCode โดยระบุจำนวน
   * @param input - voucherId, amount (จำนวนที่จะอัปเดต), price (pointsCost ใหม่)
   * @returns ข้อมูลการอัปเดตและ codes ที่ถูกอัปเดต
   */
  async updateVoucherCodesPointCost(input: UpdateVoucherCodesPointCostInput) {
    const { voucherId, amount, price } = input;

    // Validate input
    if (!voucherId) {
      throw new BadRequestException('voucherId is required');
    }

    if (amount <= 0) {
      throw new BadRequestException('amount must be greater than 0');
    }

    if (price < 0) {
      throw new BadRequestException('price must be greater than or equal to 0');
    }

    try {
      // ตรวจสอบว่า voucher มีอยู่จริง
      const voucher = await this.prisma.voucher.findUnique({
        where: { id: voucherId },
      });

      if (!voucher) {
        throw new NotFoundException(`Voucher with id '${voucherId}' not found`);
      }

      // หา VoucherCode ที่ยังไม่ได้ใช้งาน (isUsed = false) จำนวนที่ต้องการ
      const voucherCodesToUpdate = await this.prisma.voucherCode.findMany({
        where: {
          voucherId,
          isUsed: false,
        },
        take: amount,
        select: {
          id: true,
          code: true,
          pointsCost: true,
        },
      });

      if (voucherCodesToUpdate.length === 0) {
        throw new NotFoundException(
          `No unused voucher codes found for voucher '${voucherId}'`,
        );
      }

      if (voucherCodesToUpdate.length < amount) {
        this.logger.warn(
          `Requested ${amount} codes but only found ${voucherCodesToUpdate.length} unused codes`,
        );
      }

      // อัปเดต pointsCost ของ codes ที่เลือก
      const updateResult = await this.prisma.voucherCode.updateMany({
        where: {
          id: {
            in: voucherCodesToUpdate.map((c) => c.id),
          },
        },
        data: {
          pointsCost: price,
        },
      });

      this.logger.log(
        `Updated pointsCost to ${price} for ${updateResult.count} voucher codes of voucher '${voucherId}'`,
      );

      return {
        success: true,
        voucherId,
        updatedCount: updateResult.count,
        requestedAmount: amount,
        newPointsCost: price,
        updatedCodes: voucherCodesToUpdate.map((c) => ({
          code: c.code,
          oldPointsCost: c.pointsCost,
          newPointsCost: price,
        })),
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      this.logger.error(
        `Error updating voucher codes point cost: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException('Failed to update voucher codes');
    }
  }

  /**
   * อัปเดต pointsCost ของ VoucherCode ทั้งหมด และอัปเดตข้อมูล voucher
   * @param voucherId - ID ของ voucher
   * @param price - pointsCost ใหม่
   * @param name - ชื่อ voucher (optional)
   * @param description - คำอธิบาย (optional)
   * @param value - มูลค่า (optional)
   * @param endDate - วันหมดอายุ (optional)
   * @returns ข้อมูลการอัปเดต
   */
  async updateAllVoucherCodesPointCost(
    voucherId: string,
    price: number,
    name?: string,
    description?: string,
    value?: number,
    endDate?: string,
  ) {
    if (!voucherId) {
      throw new BadRequestException('voucherId is required');
    }

    if (price < 0) {
      throw new BadRequestException('price must be greater than or equal to 0');
    }

    try {
      // ใช้ transaction เพื่ออัปเดตทั้ง voucher และ voucher codes
      const result = await this.prisma.$transaction(async (tx) => {
        // ตรวจสอบว่า voucher มีอยู่จริง
        const voucher = await tx.voucher.findUnique({
          where: { id: voucherId },
          include: {
            _count: {
              select: {
                voucherCodes: true,
              },
            },
          },
        });

        if (!voucher) {
          throw new NotFoundException(
            `Voucher with id '${voucherId}' not found`,
          );
        }

        // Validate AIS Point voucher value must not exceed 100
        if (
          value !== undefined &&
          voucher.valueType === 'aispoint' &&
          value > 100
        ) {
          throw new BadRequestException(
            'AIS Point voucher value must not exceed 100',
          );
        }

        // 1. อัปเดตข้อมูล voucher (ถ้ามี)
        const voucherUpdateData: any = {};

        if (name !== undefined) voucherUpdateData.name = name;
        if (description !== undefined)
          voucherUpdateData.description = description;
        if (value !== undefined) voucherUpdateData.value = value;
        if (endDate !== undefined)
          voucherUpdateData.endDate = new Date(endDate);

        if (Object.keys(voucherUpdateData).length > 0) {
          await tx.voucher.update({
            where: { id: voucherId },
            data: voucherUpdateData,
          });

          this.logger.log(
            `Updated voucher '${voucherId}' with fields: ${Object.keys(voucherUpdateData).join(', ')}`,
          );
        }

        // 2. อัปเดต pointsCost ของ codes ทั้งหมดที่ยังไม่ได้ใช้
        const updateResult = await tx.voucherCode.updateMany({
          where: {
            voucherId,
            isUsed: false,
          },
          data: {
            pointsCost: price,
          },
        });

        this.logger.log(
          `Updated pointsCost to ${price} for all ${updateResult.count} unused voucher codes of voucher '${voucherId}'`,
        );

        return {
          updateResult,
          totalCodes: voucher._count.voucherCodes,
        };
      });

      return {
        success: true,
        voucherId,
        updatedCount: result.updateResult.count,
        totalCodes: result.totalCodes,
        newPointsCost: price,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      this.logger.error(
        `Error updating all voucher codes: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException('Failed to update all voucher codes');
    }
  }

  /**
   * รีเซ็ต pointsCost ของ codes ที่ถูกอัปเดตแล้วกลับไปเป็นค่าเดิม
   * @param voucherId - ID ของ voucher
   * @param originalPrice - ราคาเดิมที่จะรีเซ็ตกลับ
   * @returns ข้อมูลการรีเซ็ต
   */
  async resetVoucherCodesPointCost(voucherId: string, originalPrice: number) {
    return this.updateAllVoucherCodesPointCost(voucherId, originalPrice);
  }

  /**
   * ดึงข้อมูล VoucherCode พร้อมสถิติ pointsCost
   * @param voucherId - ID ของ voucher
   * @returns สถิติและรายละเอียดของ codes
   */
  async getVoucherCodesStatistics(voucherId: string) {
    const codes = await this.prisma.voucherCode.findMany({
      where: { voucherId },
      select: {
        id: true,
        code: true,
        pointsCost: true,
        isUsed: true,
        usedBy: true,
        usedAt: true,
      },
    });

    if (codes.length === 0) {
      throw new NotFoundException(
        `No voucher codes found for voucher '${voucherId}'`,
      );
    }

    // คำนวณสถิติ
    const unusedCodes = codes.filter((c) => !c.isUsed);
    const usedCodes = codes.filter((c) => c.isUsed);

    // จัดกลุ่มตาม pointsCost
    const priceGroups = codes.reduce(
      (acc, code) => {
        const price = code.pointsCost;
        if (!acc[price]) {
          acc[price] = { count: 0, unused: 0, used: 0 };
        }
        acc[price].count++;
        if (code.isUsed) {
          acc[price].used++;
        } else {
          acc[price].unused++;
        }
        return acc;
      },
      {} as Record<number, { count: number; unused: number; used: number }>,
    );

    return {
      voucherId,
      totalCodes: codes.length,
      unusedCount: unusedCodes.length,
      usedCount: usedCodes.length,
      priceGroups,
      codes: codes.map((c) => ({
        code: c.code,
        pointsCost: c.pointsCost,
        isUsed: c.isUsed,
        usedBy: c.usedBy,
        usedAt: c.usedAt,
      })),
    };
  }
}
