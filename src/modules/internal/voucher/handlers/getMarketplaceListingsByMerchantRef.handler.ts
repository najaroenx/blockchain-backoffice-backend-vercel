import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';
import { PrismaService } from 'prisma/prisma.service';
import { MerchantRefEnrichmentService } from 'src/modules/shared/services/merchant-ref-enrichment.service';
import {
  AvailableCountRow,
  CodeOwnerMerchantRow,
  ListingDetailRow,
  buildMarketplaceListings,
  emptyMarketplaceResponse,
  fetchCodeOwnerMerchants,
  mapAvailableCounts,
  mapListingDetails,
  paginateMarketplaceListings,
} from '../utils/marketplace-listing.util';

@Injectable()
export class GetMarketplaceListingsByMerchantRef {
  private logger = new Logger(GetMarketplaceListingsByMerchantRef.name);
  private thbAddress: string;

  constructor(
    private blockchainService: BlockchainService,
    private prisma: PrismaService,
    private configService: ConfigService,
    private merchantRefEnrichment: MerchantRefEnrichmentService,
  ) {
    this.thbAddress = this.configService.get<string>('THB_ADDRESS') || '';
  }

  /**
   * Get active marketplace listings filtered by merchantRef
   * @param merchantRef - MerchantRef to filter vouchers by
   * @param page - Optional: page number for pagination
   * @param limit - Optional: items per page
   */
  async execute(merchantRef: string, page?: number, limit?: number) {
    try {
      this.logger.log(
        `[GetMarketplaceListingsByMerchantRef] Fetching listings for merchantRef=${merchantRef} (page=${page}, limit=${limit})`,
      );

      const blockchainListings =
        await this.blockchainService.getAllActiveMarketplaceListings();

      this.logger.log(
        `[GetMarketplaceListingsByMerchantRef] Found ${blockchainListings.length} active listings on blockchain`,
      );

      if (blockchainListings.length === 0) {
        return emptyMarketplaceResponse(page, limit);
      }

      const listingIds = blockchainListings.map((l) => l.listingId);
      const { detailMap, countMap, codeOwnerMerchantMap } =
        await this.fetchListingData(listingIds, merchantRef);

      if (detailMap.size === 0) {
        this.logger.log(
          `[GetMarketplaceListingsByMerchantRef] No listings found for merchantRef=${merchantRef}`,
        );
        return emptyMarketplaceResponse(page, limit);
      }

      const merchantRefDetail =
        await this.merchantRefEnrichment.enrich(merchantRef);

      const validListings = this.buildValidListings(
        blockchainListings,
        detailMap,
        countMap,
        codeOwnerMerchantMap,
        merchantRefDetail,
      );

      this.logger.log(
        `[GetMarketplaceListingsByMerchantRef] Found ${validListings.length} valid listings for merchantRef=${merchantRef}`,
      );

      return this.paginate(validListings, page, limit);
    } catch (error) {
      this.logger.error(
        `[GetMarketplaceListingsByMerchantRef] Failed: ${error.message}`,
      );
      throw error;
    }
  }

  /** Fetch all DB data for listings filtered by merchantRef */
  private async fetchListingData(listingIds: string[], merchantRef: string) {
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
        v."merchantRef" AS "voucherMerchantRef",
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
        AND vc."pointId" IS NOT NULL
        AND v."merchantRef" = ${merchantRef}
        AND (vc."currentOwnerType" IS NULL OR vc."currentOwnerType" != 'CUSTOMER')
      ORDER BY vc."voucherGroupId", vc.created_at ASC
    `;

    const detailMap = mapListingDetails(listingDetails);

    if (listingDetails.length === 0) {
      return {
        detailMap,
        countMap: new Map<string, number>(),
        codeOwnerMerchantMap: new Map<string, CodeOwnerMerchantRow>(),
      };
    }

    const filteredListingIds = listingDetails.map((d) => d.voucherGroupId);

    const availableCounts = await this.prisma.$queryRaw<AvailableCountRow[]>`
      SELECT
        vc."voucherGroupId",
        COUNT(*)::bigint AS "availableCount"
      FROM "VoucherCode" vc
      JOIN "Voucher" v ON vc."voucherId" = v.id
      WHERE vc."voucherGroupId" IN (${Prisma.join(filteredListingIds)})
        AND vc."isUsed" = false
        AND v."merchantRef" = ${merchantRef}
        AND (vc."currentOwnerType" IS NULL OR vc."currentOwnerType" != 'CUSTOMER')
      GROUP BY vc."voucherGroupId"
    `;

    const countMap = mapAvailableCounts(availableCounts);
    const codeOwnerMerchantMap = await fetchCodeOwnerMerchants(
      this.prisma,
      listingDetails,
    );

    this.logger.log(
      `[GetMarketplaceListingsByMerchantRef] SQL returned ${listingDetails.length} listing details for merchantRef=${merchantRef}`,
    );

    return { detailMap, countMap, codeOwnerMerchantMap };
  }

  /** Build valid listings by mapping blockchain data to DB data */
  private buildValidListings(
    blockchainListings: any[],
    detailMap: Map<string, ListingDetailRow>,
    countMap: Map<string, number>,
    codeOwnerMerchantMap: Map<string, CodeOwnerMerchantRow>,
    merchantRefDetail: any,
  ) {
    return buildMarketplaceListings({
      blockchainListings,
      detailMap,
      countMap,
      codeOwnerMerchantMap,
      thbAddress: this.thbAddress,
      includeMerchantRef: true,
      merchantRefDetailFor: () => merchantRefDetail,
    });
  }

  /** Apply pagination if page and limit are provided */
  private paginate(validListings: any[], page?: number, limit?: number) {
    return paginateMarketplaceListings(validListings, page, limit);
  }
}
