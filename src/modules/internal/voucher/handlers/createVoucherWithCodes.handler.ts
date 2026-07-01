import {
  Injectable,
  InternalServerErrorException,
  Logger,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';
import { CreateVoucherDto } from '../dtos/voucher.dto';
import { randomUUID } from 'node:crypto';

@Injectable()
export class CreateVoucherWithCodes {
  private readonly logger = new Logger(CreateVoucherWithCodes.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly blockchainService: BlockchainService,
  ) {}

  /**
   * Execute voucher creation
   * @param data - Voucher DTO
   * @param merchantId - Optional merchant ID to lookup seller wallet
   */
  async execute(data: CreateVoucherDto, merchantId?: string) {
    try {
      // Validate AIS Point voucher value must not exceed 100
      if (data.valueType === 'aispoint' && data.value > 100) {
        throw new BadRequestException(
          'AIS Point voucher value must not exceed 100',
        );
      }

      if (merchantId) {
        await this.lookupSellerWallet(merchantId);
      }

      const point = await this.validatePoint(data);
      const merchantName = await this.resolveMerchantName(
        merchantId || data.merchantId,
      );

      const result = await this.createVoucherTransaction(
        data,
        merchantId,
        merchantName,
        point,
      );

      this.logger.log(
        `Created voucher ${result.voucher.id} (metadata only, no codes created yet)`,
      );

      return {
        success: true,
        voucher: result.voucher,
        pointsCost: result.pointsCost,
        pointId: result.pointId,
        pointSymbol: point?.symbol || null,
        message: point
          ? `Voucher created successfully. Use activate endpoint with pointId="${result.pointId}" and currency="${point.symbol}" to create ${data.totalIssued} codes.`
          : `Voucher created successfully. Merchant will set point currency during activation to create ${data.totalIssued} codes.`,
        note: 'Voucher codes will be created when activating the voucher',
      };
    } catch (error) {
      this.logger.error(
        `Error creating voucher: ${error.message}`,
        error.stack,
      );

      if (error instanceof ConflictException) {
        throw error;
      }

      if (error.code === 'P2002' && error.meta?.target?.includes('id')) {
        throw new ConflictException('Duplicate coupon ID');
      }

      throw new InternalServerErrorException('Failed to create voucher');
    }
  }

  /** Lookup seller wallet address for a merchant */
  private async lookupSellerWallet(
    merchantId: string,
  ): Promise<string | undefined> {
    const merchantWallet = await this.prisma.wallet.findFirst({
      where: { merchant: { id: merchantId } },
    });

    if (!merchantWallet) return undefined;

    const sellerWallet = await this.prisma.wallet.findFirst({
      where: {
        type: 'seller',
        derivationIndex: merchantWallet.derivationIndex + 1,
        phoneNumber: merchantWallet.phoneNumber,
      },
    });

    if (sellerWallet) {
      this.logger.log(
        `[CreateVoucherWithCodes] Found seller wallet for merchant ${merchantId}: ${sellerWallet.walletAddress}`,
      );
      return sellerWallet.walletAddress;
    }

    return undefined;
  }

  /** Validate that the point exists and belongs to the merchant (if provided) */
  private async validatePoint(data: CreateVoucherDto): Promise<{
    id: string;
    symbol: string;
    merchantId: string;
    name: string;
  } | null> {
    if (!data.pointId) {
      this.logger.log(
        `[STEP 0] No pointId provided - will be set during activation`,
      );
      return null;
    }

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
    return point;
  }

  /** Resolve merchant name from merchantId */
  private async resolveMerchantName(merchantId?: string): Promise<string> {
    if (!merchantId) return 'Unknown';

    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { name: true },
    });
    return merchant?.name || 'Unknown';
  }

  /** Create voucher in a Prisma transaction with blockchain coupon type */
  private async createVoucherTransaction(
    data: CreateVoucherDto,
    merchantId: string | undefined,
    merchantName: string,
    point: { id: string; symbol: string } | null,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const {
          pointsCost,
          pointId,
          startDate,
          endDate,
          merchantRef,
          merchantId: _mid,
          ...voucherData
        } = data;
        void _mid;

        const couponId = `COUPON-${randomUUID()}`;
        const isSellerVoucher = Boolean(merchantId);
        const persistedMerchantId = isSellerVoucher ? null : _mid || null;
        const persistedSellerMerchantId = isSellerVoucher ? merchantId : null;

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

        const voucher = await tx.voucher.create({
          data: {
            id: couponId,
            ...voucherData,
            merchantId: persistedMerchantId,
            merchantName,
            merchantRef,
            sellerMerchantId: persistedSellerMerchantId,
            currency: point?.symbol || null,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            totalRedeemed: 0,
            tokenId: onChainTypeId,
          },
        });

        this.logger.log(
          `Created voucher metadata ${voucher.id} with tokenId: ${onChainTypeId}`,
        );

        return { voucher, pointsCost, pointId };
      },
      {
        timeout: 60000,
      },
    );
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
