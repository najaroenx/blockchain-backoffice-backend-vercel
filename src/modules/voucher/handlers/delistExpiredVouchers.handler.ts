import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'prisma/prisma.service';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';
import { TokenService } from 'src/providers/token/token.service';
import { getSignerFromSeedPhrase } from 'src/libs/derive-wallet';

// Use string literal for 'expired' status until Prisma types are regenerated after migration
const EXPIRED_STATUS = 'expired' as const;

@Injectable()
export class DelistExpiredVouchers {
  private logger = new Logger(DelistExpiredVouchers.name);

  constructor(
    private prisma: PrismaService,
    private blockchainService: BlockchainService,
    private tokenService: TokenService,
    private configService: ConfigService,
  ) {}

  async execute(): Promise<{
    processed: number;
    delisted: number;
    failed: number;
    errors: string[];
  }> {
    this.logger.log('[DelistExpiredVouchers] Starting cron job...');
    const now = new Date();
    const errors: string[] = [];
    let processed = 0;
    let delisted = 0;
    let failed = 0;

    try {
      // 1. Find all VoucherCodes with voucherGroupId (listed) that have expired vouchers
      const expiredListedCodes = await this.prisma.voucherCode.findMany({
        where: {
          voucherGroupId: { not: null },
          voucher: {
            endDate: { lt: now },
            status: { not: EXPIRED_STATUS as any }, // Skip already processed vouchers
          },
        },
        include: {
          voucher: {
            select: {
              id: true,
              name: true,
              endDate: true,
              merchantId: true,
            },
          },
        },
      });

      this.logger.log(
        `[DelistExpiredVouchers] Found ${expiredListedCodes.length} unique expired listings`,
      );

      // 2. Group by voucherGroupId (listingId) and track vouchers to update
      const listingsToProcess = new Map<
        string,
        { voucherId: string; voucherName: string; merchantId: string | null }
      >();
      const voucherIdsToExpire = new Set<string>();

      for (const code of expiredListedCodes) {
        if (
          code.voucherGroupId &&
          !listingsToProcess.has(code.voucherGroupId)
        ) {
          // Determine seller: code owner (if MERCHANT) or voucher merchant
          const sellerId =
            code.currentOwnerType === 'MERCHANT'
              ? code.currentOwnerId
              : (code.voucher?.merchantId ?? null);

          listingsToProcess.set(code.voucherGroupId, {
            voucherId: code.voucher?.id ?? code.voucherId,
            voucherName: code.voucher?.name ?? 'Unknown',
            merchantId: sellerId,
          });

          if (code.voucher?.id) {
            voucherIdsToExpire.add(code.voucher.id);
          }
        }
      }

      // 3. Process each listing
      for (const [listingId, info] of listingsToProcess) {
        processed++;
        this.logger.log(
          `[DelistExpiredVouchers] Processing listing ${listingId} (voucher: ${info.voucherName})`,
        );

        try {
          // 3.1 Get merchant wallet
          if (!info.merchantId) {
            this.logger.warn(
              `[DelistExpiredVouchers] No merchant for listing ${listingId}, skipping blockchain delist`,
            );
            // Still clear the voucherGroupId even if we can't delist on blockchain
            await this.prisma.voucherCode.updateMany({
              where: { voucherGroupId: listingId },
              data: { voucherGroupId: null },
            });
            continue;
          }

          const merchant = await this.prisma.merchant.findUnique({
            where: { id: info.merchantId },
            include: { wallet: true },
          });

          if (!merchant?.wallet?.seedPhrase) {
            this.logger.warn(
              `[DelistExpiredVouchers] No wallet for merchant ${info.merchantId}, skipping blockchain delist`,
            );
            // Still clear the voucherGroupId
            await this.prisma.voucherCode.updateMany({
              where: { voucherGroupId: listingId },
              data: { voucherGroupId: null },
            });
            continue;
          }

          // 3.2 Decrypt and get private key
          const salt = this.configService.get<string>('SALT');
          const decryptedSeedPhrase = this.tokenService.decryptKey(
            salt,
            merchant.wallet.seedPhrase,
          );

          if (!decryptedSeedPhrase) {
            this.logger.warn(
              `[DelistExpiredVouchers] Failed to decrypt seed phrase for ${info.merchantId}`,
            );
            continue;
          }

          const signer = getSignerFromSeedPhrase(
            decryptedSeedPhrase,
            merchant.wallet.derivationIndex || 0,
          );

          // 3.3 Cancel listing on blockchain
          this.logger.log(
            `[DelistExpiredVouchers] Canceling listing ${listingId} on blockchain...`,
          );

          try {
            await this.blockchainService.delistCoupon(
              listingId,
              signer.privateKey,
            );
            this.logger.log(
              `[DelistExpiredVouchers] ✅ Blockchain delist successful for ${listingId}`,
            );
          } catch (blockchainError) {
            // Log but continue - listing might already be canceled or not exist
            this.logger.warn(
              `[DelistExpiredVouchers] Blockchain delist failed for ${listingId}: ${blockchainError.message}`,
            );
          }

          // 3.4 Clear voucherGroupId in database
          await this.prisma.voucherCode.updateMany({
            where: { voucherGroupId: listingId },
            data: { voucherGroupId: null },
          });

          this.logger.log(
            `[DelistExpiredVouchers] ✅ Cleared voucherGroupId for listing ${listingId}`,
          );
          delisted++;
        } catch (error) {
          failed++;
          const errorMsg = `Failed to delist ${listingId}: ${error.message}`;
          errors.push(errorMsg);
          this.logger.error(`[DelistExpiredVouchers] ❌ ${errorMsg}`);
        }
      }

      // 4. Update voucher status to 'expired' for all affected vouchers
      if (voucherIdsToExpire.size > 0) {
        const voucherIds = Array.from(voucherIdsToExpire);
        await this.prisma.voucher.updateMany({
          where: { id: { in: voucherIds } },
          data: { status: EXPIRED_STATUS as any },
        });
        this.logger.log(
          `[DelistExpiredVouchers] Updated ${voucherIds.length} vouchers to 'expired' status`,
        );
      }

      // 5. Also update any vouchers that are expired but have no listings (endDate passed)
      const expiredNoListingVouchers = await this.prisma.voucher.updateMany({
        where: {
          endDate: { lt: now },
          status: { not: EXPIRED_STATUS as any },
        },
        data: { status: EXPIRED_STATUS as any },
      });

      if (expiredNoListingVouchers.count > 0) {
        this.logger.log(
          `[DelistExpiredVouchers] Updated ${expiredNoListingVouchers.count} additional expired vouchers (no listings)`,
        );
      }

      this.logger.log(
        `[DelistExpiredVouchers] Completed. Processed: ${processed}, Delisted: ${delisted}, Failed: ${failed}`,
      );

      return { processed, delisted, failed, errors };
    } catch (error) {
      this.logger.error(
        `[DelistExpiredVouchers] Fatal error: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
