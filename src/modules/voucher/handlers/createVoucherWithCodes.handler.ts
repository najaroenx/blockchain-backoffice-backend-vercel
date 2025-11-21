import {
  Injectable,
  InternalServerErrorException,
  Logger,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';
import { CreateVoucherDto } from '../dtos/voucher.dto';
import { randomUUID } from 'crypto';

@Injectable()
export class CreateVoucherWithCodes {
  private logger = new Logger(CreateVoucherWithCodes.name);

  constructor(
    private prisma: PrismaService,
    private blockchainService: BlockchainService,
  ) {}

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

      // Get merchant information if merchantId is provided
      let merchantName = 'Unknown';
      if (data.merchantId) {
        const merchant = await this.prisma.merchant.findUnique({
          where: { id: data.merchantId },
          select: { name: true },
        });
        if (merchant) {
          merchantName = merchant.name;
        }
      }

      // สร้างเฉพาะ voucher metadata (ไม่สร้าง codes)
      const result = await this.prisma.$transaction(async (tx) => {
        // 1. แยก pointsCost, pointId, dates ออกจาก voucherData
        const { pointsCost, pointId, startDate, endDate, ...voucherData } =
          data;

        // 2. Generate coupon ID และ merchantRef
        const couponId = `COUPON-${randomUUID()}`;
        const merchantRef = `REF-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

        // 3. Create coupon type on blockchain (ERC-1155)
        this.logger.log(`Creating coupon type on blockchain...`);
        const startTimestamp = Math.floor(new Date(startDate).getTime() / 1000);
        const endTimestamp = Math.floor(new Date(endDate).getTime() / 1000);

        const blockchainResult = await this.blockchainService.createCouponType(
          voucherData.name,
          startTimestamp,
          endTimestamp,
        );

        const onChainTypeId = blockchainResult.typeId;
        this.logger.log(
          `Coupon type created on blockchain. TypeId: ${onChainTypeId}, TxHash: ${blockchainResult.hash}`,
        );

        // 4. สร้าง voucher (metadata พร้อม tokenId, merchantName, currency)
        const voucher = await tx.voucher.create({
          data: {
            id: couponId,
            ...voucherData,
            merchantName, // ← ดึงมาจาก Merchant.name
            merchantRef, // ← สำหรับ verify ตอน redeem
            currency: point.symbol, // ← ดึงมาจาก Point.symbol
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            totalRedeemed: 0, // ← เริ่มต้นที่ 0
            tokenId: onChainTypeId, // Save ERC-1155 typeId from smart contract
          },
        });

        this.logger.log(
          `Created voucher metadata ${voucher.id} with tokenId: ${onChainTypeId}`,
        );

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
