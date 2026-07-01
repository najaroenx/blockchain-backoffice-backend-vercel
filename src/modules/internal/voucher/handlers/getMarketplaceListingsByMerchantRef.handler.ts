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
  paginateMarketplaceListings,
} from '../utils/marketplace-listing.util';

@Injectable()
export class GetMarketplaceListingsByMerchantRef {
  private readonly logger = new Logger(GetMarketplaceListingsByMerchantRef.name);
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
    const listingData = await fetchMarketplaceListingData(
      this.prisma,
      listingIds,
      { pointOnly: true, merchantRef },
    );

    this.logger.log(
      `[GetMarketplaceListingsByMerchantRef] SQL returned ${listingData.listingDetailsCount} listing details for merchantRef=${merchantRef}`,
    );

    return listingData;
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
