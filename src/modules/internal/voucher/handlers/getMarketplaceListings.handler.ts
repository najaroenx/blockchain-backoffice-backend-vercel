import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';
import { PrismaService } from 'prisma/prisma.service';
import {
  AvailableCountRow,
  CodeOwnerMerchantRow,
  ListingDetailRow,
  buildMarketplaceListings,
  emptyMarketplaceResponse,
  fetchCodeOwnerMerchants,
  filterSellerListings,
  mapAvailableCounts,
  mapListingDetails,
  paginateMarketplaceListings,
} from '../utils/marketplace-listing.util';

@Injectable()
export class GetMarketplaceListings {
  private logger = new Logger(GetMarketplaceListings.name);
  private thbAddress: string;

  constructor(
    private blockchainService: BlockchainService,
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.thbAddress = this.configService.get<string>('THB_ADDRESS') || '';
  }

  /**
   * Get all active marketplace listings with voucher details
   * @param merchantId - Optional: filter by merchant
   * @param sellerOnly - Optional: filter only seller listings (THB payment token)
   * @param page - Optional: page number for pagination
   * @param limit - Optional: items per page
   */
  async execute(
    merchantId?: string,
    sellerOnly: boolean = false,
    page?: number,
    limit?: number,
  ) {
    try {
      this.logger.log(
        `[GetMarketplaceListings] Fetching active listings from blockchain... (sellerOnly=${sellerOnly}, page=${page}, limit=${limit})`,
      );

      let blockchainListings =
        await this.blockchainService.getAllActiveMarketplaceListings();

      this.logger.log(
        `[GetMarketplaceListings] Found ${blockchainListings.length} active listings on blockchain`,
      );

      const beforeSellerFilterCount = blockchainListings.length;
      blockchainListings = filterSellerListings(
        blockchainListings,
        sellerOnly,
        this.thbAddress,
      );
      if (sellerOnly && this.thbAddress) {
        this.logger.log(
          `[GetMarketplaceListings] Filtered to ${blockchainListings.length} seller listings (from ${beforeSellerFilterCount}) using THB payment token`,
        );
      }

      if (blockchainListings.length === 0) {
        return emptyMarketplaceResponse(page, limit);
      }

      const listingIds = blockchainListings.map((l) => l.listingId);
      const { detailMap, countMap, codeOwnerMerchantMap } =
        await this.fetchListingData(listingIds);

      const validListings = this.buildValidListings(
        blockchainListings,
        detailMap,
        countMap,
        codeOwnerMerchantMap,
        merchantId,
      );

      this.logger.log(
        `[GetMarketplaceListings] Found ${validListings.length} valid listings`,
      );

      return this.paginate(validListings, page, limit);
    } catch (error) {
      this.logger.error(
        `[GetMarketplaceListings] Failed to get marketplace listings: ${error.message}`,
      );
      throw error;
    }
  }

  /** Fetch all DB data needed for listings in batched SQL queries */
  private async fetchListingData(listingIds: string[]) {
    const listingDetails = await this.prisma.$queryRaw<ListingDetailRow[]>`
      SELECT DISTINCT ON (vc."voucherGroupId")
        vc."voucherGroupId",
        vc.id AS "codeId",
        vc."currentOwnerId" AS "codeCurrentOwnerId",
        vc."currentOwnerType" AS "codeCurrentOwnerType",
        v.id AS "voucherId",
        v.name AS "voucherName",
        v.description AS "voucherDescription",
        v."imageUrl" AS "voucherImageUrl",
        v."valueType" AS "voucherValueType",
        v.value AS "voucherValue",
        v."startDate" AS "voucherStartDate",
        v."endDate" AS "voucherEndDate",
        v.status AS "voucherStatus",
        v."merchantId" AS "voucherMerchantId",
        v."sellerMerchantId" AS "voucherSellerMerchantId",
        m.id AS "merchantId",
        m.name AS "merchantName",
        m."imageUrl" AS "merchantImageUrl",
        w."walletAddress" AS "merchantWalletAddress",
        p.id AS "pointId",
        p.name AS "pointName",
        p.symbol AS "pointSymbol",
        p."contractAddress" AS "pointContractAddress",
        p."imageUrl" AS "pointImageUrl"
      FROM "VoucherCode" vc
      JOIN "Voucher" v ON vc."voucherId" = v.id
      LEFT JOIN "Merchant" m ON v."merchantId" = m.id
      LEFT JOIN "Wallet" w ON m."walletId" = w.id
      LEFT JOIN "Point" p ON vc."pointId" = p.id
      WHERE vc."voucherGroupId" IN (${Prisma.join(listingIds)})
        AND (vc."currentOwnerType" IS NULL OR vc."currentOwnerType" != 'CUSTOMER')
      ORDER BY vc."voucherGroupId", vc.created_at ASC
    `;

    const availableCounts = await this.prisma.$queryRaw<AvailableCountRow[]>`
      SELECT
        vc."voucherGroupId",
        COUNT(*)::bigint AS "availableCount"
      FROM "VoucherCode" vc
      WHERE vc."voucherGroupId" IN (${Prisma.join(listingIds)})
        AND vc."isUsed" = false
        AND (vc."currentOwnerType" IS NULL OR vc."currentOwnerType" != 'CUSTOMER')
      GROUP BY vc."voucherGroupId"
    `;

    const detailMap = mapListingDetails(listingDetails);
    const countMap = mapAvailableCounts(availableCounts);
    const codeOwnerMerchantMap = await fetchCodeOwnerMerchants(
      this.prisma,
      listingDetails,
    );

    this.logger.log(
      `[GetMarketplaceListings] SQL returned ${listingDetails.length} listing details, ${availableCounts.length} count rows`,
    );

    return { detailMap, countMap, codeOwnerMerchantMap };
  }

  /** Build valid listings by mapping blockchain data to DB data with filtering */
  private buildValidListings(
    blockchainListings: any[],
    detailMap: Map<string, ListingDetailRow>,
    countMap: Map<string, number>,
    codeOwnerMerchantMap: Map<string, CodeOwnerMerchantRow>,
    merchantId?: string,
  ) {
    return buildMarketplaceListings({
      blockchainListings,
      detailMap,
      countMap,
      codeOwnerMerchantMap,
      thbAddress: this.thbAddress,
      merchantId,
      onMissingDetail: (listing) =>
        this.logger.warn(
          `[GetMarketplaceListings] ❌ No voucher codes found in database for listingId ${listing.listingId}`,
        ),
      onExpired: (detail) =>
        this.logger.log(
          `[GetMarketplaceListings] 🚫 Filtered expired voucher: voucherId=${detail.voucherId}`,
        ),
      onMerchantFilterMiss: (detail) =>
        this.logger.log(
          `[GetMarketplaceListings] Filtered out listing for voucherId=${detail.voucherId}: ` +
            `no match for merchantId=${merchantId}`,
        ),
      onSellerMismatch: (listing, sellerWalletAddress) =>
        this.logger.warn(
          `[GetMarketplaceListings] Seller mismatch for listing ${listing.listingId}. ` +
            `Expected: ${sellerWalletAddress}, Got: ${listing.seller}`,
        ),
      onSoldOut: (listing) =>
        this.logger.log(
          `[GetMarketplaceListings] 🚫 Filtered sold out listing: listingId=${listing.listingId}, no available codes`,
        ),
    });
  }

  /** Apply pagination if page and limit are provided */
  private paginate(validListings: any[], page?: number, limit?: number) {
    const response = paginateMarketplaceListings(validListings, page, limit);
    if (page !== undefined && limit !== undefined) {
      this.logger.log(
        `[GetMarketplaceListings] Returning page ${page} with ${response.listings.length} listings (of ${response.total})`,
      );
      return response;
    }

    this.logger.log(
      `[GetMarketplaceListings] Returning ${response.total} listings (no pagination)`,
    );

    return response;
  }
}
