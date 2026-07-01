import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';
import { PrismaService } from 'prisma/prisma.service';
import { MerchantRefEnrichmentService } from 'src/modules/shared/services/merchant-ref-enrichment.service';
import {
  CodeOwnerMerchantRow,
  ListingDetailRow,
  buildMarketplaceListings,
  emptyMarketplaceResponse,
  fetchMarketplaceListingData,
  filterSellerListings,
  paginateMarketplaceListings,
} from '../utils/marketplace-listing.util';

@Injectable()
export class GetMarketplaceListingsEndUser {
  private readonly logger = new Logger(GetMarketplaceListingsEndUser.name);
  private readonly thbAddress: string;

  constructor(
    private readonly blockchainService: BlockchainService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly merchantRefEnrichment: MerchantRefEnrichmentService,
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
        `[GetMarketplaceListingsEndUser] Fetching active listings from blockchain... (sellerOnly=${sellerOnly}, page=${page}, limit=${limit})`,
      );

      let blockchainListings =
        await this.blockchainService.getAllActiveMarketplaceListings();

      this.logger.log(
        `[GetMarketplaceListingsEndUser] Found ${blockchainListings.length} active listings on blockchain`,
      );

      const beforeSellerFilterCount = blockchainListings.length;
      blockchainListings = filterSellerListings(
        blockchainListings,
        sellerOnly,
        this.thbAddress,
      );
      if (sellerOnly && this.thbAddress) {
        this.logger.log(
          `[GetMarketplaceListingsEndUser] Filtered to ${blockchainListings.length} seller listings (from ${beforeSellerFilterCount}) using THB payment token`,
        );
      }

      if (blockchainListings.length === 0) {
        return emptyMarketplaceResponse(page, limit);
      }

      const listingIds = blockchainListings.map((l) => l.listingId);
      const { detailMap, countMap, codeOwnerMerchantMap } =
        await this.fetchListingData(listingIds);

      const merchantRefMap = await this.enrichMerchantRefs(
        Array.from(detailMap.values()),
      );

      const validListings = this.buildValidListings(
        blockchainListings,
        detailMap,
        countMap,
        codeOwnerMerchantMap,
        merchantRefMap,
        merchantId,
      );

      // Sort: newest listed first
      validListings.sort(
        (a, b) =>
          new Date(b.listedAt).getTime() - new Date(a.listedAt).getTime(),
      );

      this.logger.log(
        `[GetMarketplaceListingsEndUser] Found ${validListings.length} valid listings`,
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
    const listingData = await fetchMarketplaceListingData(
      this.prisma,
      listingIds,
      { pointOnly: true },
    );

    this.logger.log(
      `[GetMarketplaceListingsEndUser] SQL returned ${listingData.listingDetailsCount} listing details, ${listingData.availableCountsCount} count rows`,
    );

    return listingData;
  }

  /** Batch-enrich all merchantRefs from listing details */
  private async enrichMerchantRefs(details: ListingDetailRow[]) {
    const refs = details
      .map((d) => d.voucherMerchantRef)
      .filter((ref): ref is string => !!ref);

    return refs.length > 0
      ? this.merchantRefEnrichment.enrichBatch(refs)
      : new Map<string, any>();
  }

  /** Build valid listings by mapping blockchain data to DB data with filtering */
  private buildValidListings(
    blockchainListings: any[],
    detailMap: Map<string, ListingDetailRow>,
    countMap: Map<string, number>,
    codeOwnerMerchantMap: Map<string, CodeOwnerMerchantRow>,
    merchantRefMap: Map<string, any>,
    merchantId?: string,
  ) {
    return buildMarketplaceListings({
      blockchainListings,
      detailMap,
      countMap,
      codeOwnerMerchantMap,
      thbAddress: this.thbAddress,
      merchantId,
      includeMerchantRef: true,
      merchantRefDetailFor: (detail) =>
        detail.voucherMerchantRef
          ? merchantRefMap.get(detail.voucherMerchantRef) || null
          : null,
      onMissingDetail: (listing) =>
        this.logger.warn(
          `[GetMarketplaceListingsEndUser] ❌ No voucher codes found in database for listingId ${listing.listingId}`,
        ),
    });
  }

  /** Apply pagination if page and limit are provided */
  private paginate(validListings: any[], page?: number, limit?: number) {
    const response = paginateMarketplaceListings(validListings, page, limit);
    if (page !== undefined && limit !== undefined) {
      this.logger.log(
        `[GetMarketplaceListingsEndUser] Returning page ${page} with ${response.listings.length} listings (of ${response.total})`,
      );
      return response;
    }

    this.logger.log(
      `[GetMarketplaceListingsEndUser] Returning ${response.total} listings (no pagination)`,
    );

    return response;
  }
}
