import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';

export interface CollidingGroup {
  voucherGroupId: string;
  totalCodes: number;
  vouchers: {
    voucherId: string;
    voucherName: string;
    merchantName: string | null;
    codeCount: number;
    oldestCreatedAt: Date;
    isOnCurrentContract: boolean;
  }[];
}

@Injectable()
export class FixVoucherGroupCollision {
  private logger = new Logger(FixVoucherGroupCollision.name);

  constructor(
    private prisma: PrismaService,
    private blockchainService: BlockchainService,
  ) {}

  /**
   * GET /fix/voucher-group-collision/detect
   * Detect voucherGroupIds shared across multiple vouchers (collision from contract redeploy)
   */
  async detect() {
    this.logger.log('Detecting voucherGroupId collisions...');

    // 1. Find all voucherGroupIds that have codes from >1 voucher
    const collisions = await this.prisma.$queryRaw<
      {
        voucherGroupId: string;
        totalCodes: bigint;
        voucherCount: number;
      }[]
    >`
      SELECT
        "voucherGroupId",
        COUNT(*)::bigint AS "totalCodes",
        COUNT(DISTINCT "voucherId")::int AS "voucherCount"
      FROM "VoucherCode"
      WHERE "voucherGroupId" IS NOT NULL
      GROUP BY "voucherGroupId"
      HAVING COUNT(DISTINCT "voucherId") > 1
      ORDER BY "voucherGroupId"::int
    `;

    if (collisions.length === 0) {
      return { total: 0, collisions: [], message: 'No collisions found' };
    }

    // 2. Get current active listing IDs from blockchain
    let activeListingIds: Set<string>;
    try {
      const listings =
        await this.blockchainService.getAllActiveMarketplaceListings();
      activeListingIds = new Set(listings.map((l) => l.listingId));
      this.logger.log(
        `Active listings on current contract: [${[...activeListingIds].join(', ')}]`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to fetch active listings: ${error.message}`,
      );
      activeListingIds = new Set();
    }

    // 3. Build detailed collision info
    const result: CollidingGroup[] = [];

    for (const col of collisions) {
      const details = await this.prisma.$queryRaw<
        {
          voucherId: string;
          voucherName: string;
          sellerMerchantId: string | null;
          merchantName: string | null;
          codeCount: bigint;
          oldestCreatedAt: Date;
        }[]
      >`
        SELECT
          vc."voucherId",
          v.name AS "voucherName",
          v."sellerMerchantId",
          COALESCE(sm.name, m.name) AS "merchantName",
          COUNT(*)::bigint AS "codeCount",
          MIN(vc.created_at) AS "oldestCreatedAt"
        FROM "VoucherCode" vc
        JOIN "Voucher" v ON vc."voucherId" = v.id
        LEFT JOIN "Merchant" m ON v."merchantId" = m.id
        LEFT JOIN "Merchant" sm ON v."sellerMerchantId" = sm.id
        WHERE vc."voucherGroupId" = ${col.voucherGroupId}
        GROUP BY vc."voucherId", v.name, v."sellerMerchantId", sm.name, m.name
        ORDER BY MIN(vc.created_at) ASC
      `;

      result.push({
        voucherGroupId: col.voucherGroupId,
        totalCodes: Number(col.totalCodes),
        vouchers: details.map((d) => ({
          voucherId: d.voucherId,
          voucherName: d.voucherName,
          merchantName: d.merchantName,
          codeCount: Number(d.codeCount),
          oldestCreatedAt: d.oldestCreatedAt,
          isOnCurrentContract: activeListingIds.has(col.voucherGroupId),
        })),
      });
    }

    return {
      total: collisions.length,
      activeListingIds: [...activeListingIds].sort(
        (a, b) => parseInt(a) - parseInt(b),
      ),
      collisions: result,
    };
  }

  /**
   * POST /fix/voucher-group-collision/clear-old
   * Clear voucherGroupId from codes belonging to old contract listings.
   * Keeps only codes whose voucherGroupId matches an active listing on the current contract.
   * @param dryRun - If true, only report what would be changed
   */
  async clearOld(dryRun: boolean = true) {
    this.logger.log(`Clearing old voucherGroupIds (dryRun=${dryRun})...`);

    // 1. Get active listing IDs on current contract
    const listings =
      await this.blockchainService.getAllActiveMarketplaceListings();
    const activeListingIds = new Set(listings.map((l) => l.listingId));

    this.logger.log(
      `Active listings on current contract: [${[...activeListingIds].join(', ')}]`,
    );

    // 2. Find colliding groupIds
    const collisions = await this.prisma.$queryRaw<
      { voucherGroupId: string }[]
    >`
      SELECT "voucherGroupId"
      FROM "VoucherCode"
      WHERE "voucherGroupId" IS NOT NULL
      GROUP BY "voucherGroupId"
      HAVING COUNT(DISTINCT "voucherId") > 1
    `;

    if (collisions.length === 0) {
      return { fixed: 0, message: 'No collisions found' };
    }

    const fixResults: {
      voucherGroupId: string;
      clearedCodes: number;
      keptVoucherId: string;
      clearedVoucherIds: string[];
    }[] = [];

    for (const col of collisions) {
      const gid = col.voucherGroupId;

      // For each collision, figure out which voucher's codes to KEEP:
      // If this groupId is active on current contract, find the voucher
      // whose codes were created by the seller currently listed.
      // Otherwise clear ALL codes for this groupId.
      const vouchersByAge = await this.prisma.$queryRaw<
        {
          voucherId: string;
          codeCount: bigint;
          oldestCreatedAt: Date;
          sellerWallet: string | null;
        }[]
      >`
        SELECT
          vc."voucherId",
          COUNT(*)::bigint AS "codeCount",
          MIN(vc.created_at) AS "oldestCreatedAt",
          w."walletAddress" AS "sellerWallet"
        FROM "VoucherCode" vc
        JOIN "Voucher" v ON vc."voucherId" = v.id
        LEFT JOIN "Merchant" sm ON v."sellerMerchantId" = sm.id
        LEFT JOIN "Wallet" w ON sm."walletId" = w.id
        WHERE vc."voucherGroupId" = ${gid}
        GROUP BY vc."voucherId", w."walletAddress"
        ORDER BY MIN(vc.created_at) ASC
      `;

      if (vouchersByAge.length < 2) continue;

      let keptVoucherId: string | null = null;

      if (activeListingIds.has(gid)) {
        // Find the listing on-chain to match seller
        try {
          const listing =
            await this.blockchainService.getMarketplaceListing(gid);
          const sellerOnChain = listing.seller.toLowerCase();

          // Keep the voucher whose seller wallet matches on-chain seller
          const match = vouchersByAge.find(
            (v) => v.sellerWallet?.toLowerCase() === sellerOnChain,
          );
          keptVoucherId = match?.voucherId || null;

          this.logger.log(
            `GroupId ${gid}: on-chain seller=${sellerOnChain}, matched voucherId=${keptVoucherId}`,
          );
        } catch (error) {
          this.logger.warn(
            `GroupId ${gid}: failed to read on-chain listing: ${error.message}`,
          );
        }
      }

      if (!keptVoucherId) {
        // If not active or can't match, keep the newest voucher's codes
        keptVoucherId = vouchersByAge[vouchersByAge.length - 1].voucherId;
        this.logger.log(
          `GroupId ${gid}: no on-chain match, keeping newest voucherId=${keptVoucherId}`,
        );
      }

      // Clear voucherGroupId for codes NOT belonging to the kept voucher
      const voucherIdsToClear = vouchersByAge
        .filter((v) => v.voucherId !== keptVoucherId)
        .map((v) => v.voucherId);

      const totalToClear = vouchersByAge
        .filter((v) => v.voucherId !== keptVoucherId)
        .reduce((sum, v) => sum + Number(v.codeCount), 0);

      if (!dryRun) {
        await this.prisma.voucherCode.updateMany({
          where: {
            voucherGroupId: gid,
            voucherId: { in: voucherIdsToClear },
          },
          data: { voucherGroupId: null },
        });
        this.logger.log(
          `GroupId ${gid}: cleared ${totalToClear} codes from vouchers [${voucherIdsToClear.join(', ')}]`,
        );
      }

      fixResults.push({
        voucherGroupId: gid,
        clearedCodes: totalToClear,
        keptVoucherId,
        clearedVoucherIds: voucherIdsToClear,
      });
    }

    const totalCleared = fixResults.reduce(
      (sum, r) => sum + r.clearedCodes,
      0,
    );

    return {
      dryRun,
      fixed: fixResults.length,
      totalCodesCleared: totalCleared,
      details: fixResults,
      message: dryRun
        ? 'Dry run complete. Use ?dryRun=false to apply changes.'
        : `Fixed ${fixResults.length} collisions, cleared ${totalCleared} codes.`,
    };
  }
}
