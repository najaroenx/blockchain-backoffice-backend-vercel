import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';

@Injectable()
export class ActivateVoucher {
  private logger = new Logger(ActivateVoucher.name);

  constructor(
    private prisma: PrismaService,
    private blockchainService: BlockchainService,
  ) {}

  async execute(
    voucherId: string,
    amount: number,
    pointsCost: number,
    pointId: string,
    currency: string,
  ) {
    try {
      this.logger.log(
        `[START] Activating voucher ${voucherId} with amount: ${amount}, pointsCost: ${pointsCost}, pointId: ${pointId}, currency: ${currency}`,
      );

      // 1. Validate voucher
      this.logger.log(`[STEP 1] Checking voucher data...`);
      const upcomingVoucher = await this.prisma.voucher.findUnique({
        where: { id: voucherId },
        include: {
          _count: {
            select: { voucherCodes: true },
          },
        },
      });

      if (!upcomingVoucher) {
        throw new NotFoundException(`Voucher with ID ${voucherId} not found`);
      }

      // 1.5 Validate point & currency
      this.logger.log(`[STEP 1.5] Validating point ${pointId}`);
      const point = await this.prisma.point.findUnique({
        where: { id: pointId },
        select: { id: true, symbol: true, merchantId: true, name: true },
      });

      if (!point) {
        throw new NotFoundException(`Point with ID ${pointId} not found`);
      }

      if (point.merchantId !== upcomingVoucher.merchantId) {
        throw new BadRequestException(
          `Point does not belong to this voucher's merchant`,
        );
      }

      if (point.symbol !== currency) {
        throw new BadRequestException(
          `Currency mismatch: expected ${point.symbol}, got ${currency}`,
        );
      }

      // 2. Count existing active codes
      const activeCodesCount = await this.prisma.voucherCode.count({
        where: { voucherId, voucherGroupId: { not: null } },
      });

      // 3. Validate amount
      if (amount > upcomingVoucher.totalIssued) {
        throw new BadRequestException(
          `Cannot activate ${amount} codes. Only ${upcomingVoucher.totalIssued} remaining.`,
        );
      }

      // 4. MAIN TRANSACTION (NO createMany here)
      this.logger.log(`[STEP 4] Starting transaction...`);

      const generatedCodes: string[] = [];
      let listingId: string | null = null;

      const transactionOutput = await this.prisma.$transaction(async (tx) => {
        // 4.1 generate sequential codes
        const existingCodesCount = await tx.voucherCode.count({
          where: { voucherId },
        });

        for (let i = 1; i <= amount; i++) {
          const seq = existingCodesCount + i;
          generatedCodes.push(
            `${voucherId}-${seq.toString().padStart(4, '0')}`,
          );
        }

        // 4.2 mint NFT
        this.logger.log(`[STEP 4.2] Minting coupons on blockchain...`);

        const merchant = await tx.merchant.findUnique({
          where: { id: upcomingVoucher.merchantId },
          include: { wallet: true },
        });

        if (!merchant?.wallet?.walletAddress) {
          throw new Error('Merchant wallet missing');
        }

        await this.blockchainService.mintCoupon(
          merchant.wallet.walletAddress,
          upcomingVoucher.tokenId,
          amount,
        );

        // 4.3 list on marketplace
        this.logger.log(`[STEP 4.3] Listing coupon on marketplace...`);
        try {
          const thbTokenAddress = process.env.THB_TOKEN_ADDRESS;
          const listResult = await this.blockchainService.listCoupon(
            upcomingVoucher.tokenId,
            amount,
            pointsCost.toString(),
            thbTokenAddress,
          );
          listingId = listResult.listingId;
        } catch (error: any) {
          this.logger.warn(
            `[WARN] Failed to list, fallback listingId created.`,
            error,
          );
          listingId = `${voucherId}-${Date.now()}`;
        }

        // 4.4 update voucher after issuing codes
        const newTotalIssued = upcomingVoucher.totalIssued - amount;

        await tx.voucher.update({
          where: { id: voucherId },
          data: { totalIssued: newTotalIssued },
        });

        return {
          listingId,
          newTotalIssued,
        };
      });

      listingId = transactionOutput.listingId;

      // 5) INSERT CODES **OUTSIDE TRANSACTION**
      this.logger.log(
        `[STEP 5] Creating ${generatedCodes.length} voucher codes OUTSIDE transaction`,
      );

      const chunkSize = 100;

      for (let i = 0; i < generatedCodes.length; i += chunkSize) {
        const chunk = generatedCodes.slice(i, i + chunkSize);

        await this.prisma.voucherCode.createMany({
          data: chunk.map((code) => ({
            code,
            voucherId,
            pointsCost,
            pointId,
            currency,
            voucherGroupId: listingId,
          })),
        });
      }

      this.logger.log(
        `[SUCCESS] Voucher ${voucherId} activated successfully with ${generatedCodes.length} codes.`,
      );

      return {
        success: true,
        voucherId,
        codesCreated: generatedCodes.length,
        activeCodesCount: activeCodesCount + generatedCodes.length,
        upcomingCodesCount: transactionOutput.newTotalIssued,
        listingId,
      };
    } catch (error) {
      this.logger.error(`[FATAL ERROR] ${error.message}`, error.stack);
      throw error;
    }
  }
}
