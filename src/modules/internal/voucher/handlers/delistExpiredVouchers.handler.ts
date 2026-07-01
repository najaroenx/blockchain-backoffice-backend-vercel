import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'prisma/prisma.service';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';
import { TokenService } from 'src/providers/token/token.service';
import { getSignerFromSeedPhrase } from 'src/libs/derive-wallet';

type VoucherStatusEnumRow = {
  enumlabel: string;
};

@Injectable()
export class DelistExpiredVouchers {
  private readonly logger = new Logger(DelistExpiredVouchers.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly blockchainService: BlockchainService,
    private readonly tokenService: TokenService,
    private readonly configService: ConfigService,
  ) {}

  async execute(): Promise<{
    processed: number;
    delisted: number;
    failed: number;
    errors: string[];
  }> {
    this.logger.log('[DelistExpiredVouchers] Starting cron job...');
    const now = new Date();
    const expiredStatus = await this.resolveExpiredStatusLiteral();
    const errors: string[] = [];
    let processed = 0;
    let delisted = 0;
    let failed = 0;

    try {
      const expiredListedCodes = await this.findExpiredListedCodes(
        now,
        expiredStatus,
      );

      this.logger.log(
        `[DelistExpiredVouchers] Found ${expiredListedCodes.length} unique expired listings`,
      );

      const { listingsToProcess, voucherIdsToExpire } =
        this.groupByListing(expiredListedCodes);

      for (const [listingId, info] of listingsToProcess) {
        processed++;
        this.logger.log(
          `[DelistExpiredVouchers] Processing listing ${listingId} (voucher: ${info.voucherName})`,
        );

        try {
          await this.processListing(listingId, info);
          delisted++;
        } catch (error) {
          failed++;
          const errorMsg = `Failed to delist ${listingId}: ${error.message}`;
          errors.push(errorMsg);
          this.logger.error(`[DelistExpiredVouchers] ❌ ${errorMsg}`);
        }
      }

      await this.markVouchersExpired(voucherIdsToExpire, now, expiredStatus);

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

  private async resolveExpiredStatusLiteral(): Promise<string> {
    const voucherStatusValues = await this.prisma.$queryRaw<
      VoucherStatusEnumRow[]
    >`
      SELECT e.enumlabel
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'VoucherStatus'
    `;

    const expiredStatus = voucherStatusValues.find(
      ({ enumlabel }) => enumlabel.toLowerCase() === 'expired',
    )?.enumlabel;

    if (!expiredStatus) {
      throw new Error('VoucherStatus enum is missing an expired value');
    }

    return expiredStatus;
  }

  /** Find all voucher codes with active listings whose vouchers have expired */
  private async findExpiredListedCodes(now: Date, expiredStatus: string) {
    return this.prisma.voucherCode.findMany({
      where: {
        voucherGroupId: { not: null },
        voucher: {
          endDate: { lt: now },
          status: { not: expiredStatus as any },
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
  }

  /** Group expired codes by voucherGroupId (listingId) and collect voucher IDs to expire */
  private groupByListing(
    codes: Awaited<ReturnType<typeof this.findExpiredListedCodes>>,
  ) {
    const listingsToProcess = new Map<
      string,
      { voucherId: string; voucherName: string; merchantId: string | null }
    >();
    const voucherIdsToExpire = new Set<string>();

    for (const code of codes) {
      if (!code.voucherGroupId || listingsToProcess.has(code.voucherGroupId)) {
        continue;
      }

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

    return { listingsToProcess, voucherIdsToExpire };
  }

  /** Process a single listing: delist on blockchain and clear voucherGroupId */
  private async processListing(
    listingId: string,
    info: { merchantId: string | null },
  ) {
    if (!info.merchantId) {
      this.logger.warn(
        `[DelistExpiredVouchers] No merchant for listing ${listingId}, skipping blockchain delist`,
      );
      await this.clearVoucherGroupId(listingId);
      return;
    }

    const privateKey = await this.getMerchantPrivateKey(info.merchantId);

    if (!privateKey) {
      await this.clearVoucherGroupId(listingId);
      return;
    }

    await this.delistOnBlockchain(listingId, privateKey);
    await this.clearVoucherGroupId(listingId);

    this.logger.log(
      `[DelistExpiredVouchers] ✅ Cleared voucherGroupId for listing ${listingId}`,
    );
  }

  /** Resolve merchant private key from wallet seed phrase */
  private async getMerchantPrivateKey(
    merchantId: string,
  ): Promise<string | null> {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
      include: { wallet: true },
    });

    if (!merchant?.wallet?.seedPhrase) {
      this.logger.warn(
        `[DelistExpiredVouchers] No wallet for merchant ${merchantId}, skipping blockchain delist`,
      );
      return null;
    }

    const salt = this.configService.get<string>('SALT');
    const decryptedSeedPhrase = this.tokenService.decryptKey(
      salt,
      merchant.wallet.seedPhrase,
    );

    if (!decryptedSeedPhrase) {
      this.logger.warn(
        `[DelistExpiredVouchers] Failed to decrypt seed phrase for ${merchantId}`,
      );
      return null;
    }

    const signer = getSignerFromSeedPhrase(
      decryptedSeedPhrase,
      merchant.wallet.derivationIndex || 0,
    );
    return signer.privateKey;
  }

  /** Cancel listing on blockchain (logs warning on failure but does not throw) */
  private async delistOnBlockchain(listingId: string, privateKey: string) {
    this.logger.log(
      `[DelistExpiredVouchers] Canceling listing ${listingId} on blockchain...`,
    );

    try {
      await this.blockchainService.delistCoupon(listingId, privateKey);
      this.logger.log(
        `[DelistExpiredVouchers] ✅ Blockchain delist successful for ${listingId}`,
      );
    } catch (blockchainError) {
      this.logger.warn(
        `[DelistExpiredVouchers] Blockchain delist failed for ${listingId}: ${blockchainError.message}`,
      );
    }
  }

  /** Clear voucherGroupId for all codes in a listing */
  private async clearVoucherGroupId(listingId: string) {
    await this.prisma.voucherCode.updateMany({
      where: { voucherGroupId: listingId },
      data: { voucherGroupId: null },
    });
  }

  /** Mark vouchers as expired (both listed and unlisted) */
  private async markVouchersExpired(
    voucherIdsToExpire: Set<string>,
    now: Date,
    expiredStatus: string,
  ) {
    if (voucherIdsToExpire.size > 0) {
      const voucherIds = Array.from(voucherIdsToExpire);
      await this.prisma.voucher.updateMany({
        where: { id: { in: voucherIds } },
        data: { status: expiredStatus as any },
      });
      this.logger.log(
        `[DelistExpiredVouchers] Updated ${voucherIds.length} vouchers to '${expiredStatus}' status`,
      );
    }

    const expiredNoListingVouchers = await this.prisma.voucher.updateMany({
      where: {
        endDate: { lt: now },
        status: { not: expiredStatus as any },
      },
      data: { status: expiredStatus as any },
    });

    if (expiredNoListingVouchers.count > 0) {
      this.logger.log(
        `[DelistExpiredVouchers] Updated ${expiredNoListingVouchers.count} additional expired vouchers (no listings)`,
      );
    }
  }
}
