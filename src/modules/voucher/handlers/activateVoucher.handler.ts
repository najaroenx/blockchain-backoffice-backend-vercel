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

      // 1.5. Validate Point exists and belongs to merchant
      this.logger.log(`[STEP 1.5] Validating point ${pointId}`);
      const point = await this.prisma.point.findUnique({
        where: { id: pointId },
        select: { id: true, symbol: true, merchantId: true, name: true },
      });

      if (!point) {
        this.logger.error(`[ERROR] Point ${pointId} not found`);
        throw new NotFoundException(`Point with ID ${pointId} not found`);
      }

      if (point.merchantId !== upcomingVoucher.merchantId) {
        this.logger.error(
          `[ERROR] Point belongs to different merchant. Point merchantId: ${point.merchantId}, Voucher merchantId: ${upcomingVoucher.merchantId}`,
        );
        throw new BadRequestException(
          `Point does not belong to this voucher's merchant`,
        );
      }

      if (point.symbol !== currency) {
        this.logger.error(
          `[ERROR] Currency mismatch. Expected: ${point.symbol}, Received: ${currency}`,
        );
        throw new BadRequestException(
          `Currency mismatch: expected "${point.symbol}" but got "${currency}"`,
        );
      }

      this.logger.log(
        `[STEP 1.5] Point validated ✓ (${point.name}, symbol: ${point.symbol})`,
      );

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
      const result = await this.prisma.$transaction(
        async (tx) => {
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

          // 4.2 Mint NFTs to merchant wallet
          this.logger.log(
            `[STEP 4.2] Minting ${amount} NFT coupons to merchant wallet`,
          );
          try {
            const merchant = await tx.merchant.findUnique({
              where: { id: upcomingVoucher.merchantId },
              include: { wallet: true },
            });

            if (!merchant?.wallet?.walletAddress) {
              throw new Error('Merchant wallet not configured');
            }

            // Get tokenId from voucher
            if (!upcomingVoucher.tokenId) {
              throw new Error(
                'Voucher does not have tokenId. Please create voucher with blockchain integration first.',
              );
            }

            // Batch mint: mint all units to merchant at once
            // For ERC-1155, we can mint multiple units of same type to one address
            await this.blockchainService.mintCoupon(
              merchant.wallet.walletAddress,
              upcomingVoucher.tokenId,
              amount,
            );

            this.logger.log(
              `[STEP 4.2] Minted ${amount} units of typeId ${upcomingVoucher.tokenId} to merchant ${merchant.wallet.walletAddress}`,
            );
          } catch (error) {
            this.logger.error(
              `[ERROR] Failed to mint coupons: ${error.message}`,
            );
            throw new BadRequestException(
              `Failed to mint coupons on blockchain: ${error.message}`,
            );
          }

          // 4.3 List on marketplace
          this.logger.log(
            `[STEP 4.3] Listing ${amount} coupons on marketplace at price ${pointsCost} per unit`,
          );
          let listingId = null;
          let listingSucceeded = false;
          try {
            // Get THB token address from environment
            const thbTokenAddress = process.env.THB_ADDRESS;

            if (!thbTokenAddress) {
              throw new Error('THB_TOKEN_ADDRESS not configured');
            }

            const listResult = await this.blockchainService.listCoupon(
              upcomingVoucher.tokenId,
              amount,
              pointsCost.toString(),
              thbTokenAddress,
            );

            listingId = listResult.listingId;
            listingSucceeded = true;

            this.logger.log(
              `[STEP 4.3] Listed on marketplace with listingId: ${listingId}`,
            );
          } catch (error) {
            this.logger.warn(
              `[WARN] Failed to list on marketplace: ${error.message}. Continuing without marketplace listing...`,
            );
            // If listing fails, generate fallback groupId
            listingId = `${voucherId}-${Date.now()}`;
          }

          // 4.3.1 Lock funds via marketplace purchase to create escrow
          if (listingSucceeded && listingId) {
            this.logger.log(
              `[STEP 4.3.1] Locking funds via marketplace purchase for listingId: ${listingId}`,
            );
            try {
              await this.blockchainService.lockEscrowThroughMarketplace(
                listingId,
                amount,
              );
              this.logger.log(
                `[STEP 4.3.1] Escrow locked via marketplace for listingId: ${listingId}`,
              );
            } catch (lockErr) {
              this.logger.error(
                `[ERROR] Failed to lock escrow via marketplace: ${lockErr.message}`,
              );
              throw new BadRequestException(
                `Failed to lock escrow via marketplace: ${lockErr.message}`,
              );
            }
          }

          // 4.4 Create voucher codes with listingId as voucherGroupId
          this.logger.log(
            `[STEP 4.4] Creating ${amount} active voucher codes with listingId: ${listingId}`,
          );
          const chunkSize = 100;
          for (let i = 0; i < codes.length; i += chunkSize) {
            const chunk = codes.slice(i, i + chunkSize);

            await tx.voucherCode.createMany({
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
            `[STEP 4.4] Created ${amount} codes with voucherGroupId (listingId): ${listingId}`,
          );

          // 4.5 ลด totalIssued ของ voucher
          const newTotalIssued = upcomingVoucher.totalIssued - amount;
          this.logger.log(
            `[STEP 4.6] Updating voucher: totalIssued ${upcomingVoucher.totalIssued} -> ${newTotalIssued}`,
          );

          await tx.voucher.update({
            where: { id: voucherId },
            data: {
              totalIssued: newTotalIssued,
            },
          });

          // 4.6 นับจำนวน codes ตามสถานะ (codes ที่มี voucherGroupId)
          const activeCodesCount = await tx.voucherCode.count({
            where: { voucherId, voucherGroupId: { not: null } },
          });

          this.logger.log(
            `[STEP 4.7] Active codes: ${activeCodesCount}, Upcoming: ${newTotalIssued}`,
          );

          return {
            voucherId,
            codesCreated: amount,
            activeCodesCount,
            upcomingCodesCount: newTotalIssued,
          };
        },
        {
          timeout: 120000, // extend interactive transaction timeout to handle blockchain + DB work
        },
      );

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
        pointId,
        currency,
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
