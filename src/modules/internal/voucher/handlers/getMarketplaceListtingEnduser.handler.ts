import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';
import { PrismaService } from 'prisma/prisma.service';
import { convertBufferToAddress } from 'src/libs/convertBufferToAddress';
import { MerchantRefEnrichmentService } from 'src/modules/shared/services/merchant-ref-enrichment.service';

// Use string literal for 'expired' status until Prisma types are regenerated after migration
const EXPIRED_STATUS = 'expired' as const;

// Raw SQL result types (shared with getMarketplaceListings.handler.ts)
interface ListingDetailRow {
  voucherGroupId: string;
  codeId: string;
  codeCurrentOwnerId: string | null;
  codeCurrentOwnerType: string | null;
  voucherId: string;
  voucherName: string;
  voucherDescription: string;
  voucherImageUrl: string | null;
  voucherValueType: string;
  voucherValue: number;
  voucherStartDate: Date;
  voucherEndDate: Date;
  voucherStatus: string;
  voucherMerchantId: string | null;
  voucherMerchantRef: string | null;
  voucherSellerMerchantId: string | null;
  merchantId: string | null;
  merchantName: string | null;
  merchantImageUrl: string | null;
  merchantWalletAddress: string | null;
  pointId: string | null;
  pointName: string | null;
  pointSymbol: string | null;
  pointContractAddress: Buffer | null;
  pointImageUrl: string | null;
}

interface AvailableCountRow {
  voucherGroupId: string;
  availableCount: bigint;
}

interface CodeOwnerMerchantRow {
  codeOwnerId: string;
  merchantId: string;
  merchantName: string;
  merchantImageUrl: string | null;
  merchantWalletAddress: string | null;
}

@Injectable()
export class GetMarketplaceListingsEndUser {
  private logger = new Logger(GetMarketplaceListingsEndUser.name);
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

      blockchainListings = this.filterSellerListings(
        blockchainListings,
        sellerOnly,
      );

      if (blockchainListings.length === 0) {
        return this.emptyResponse(page, limit);
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

  /** Filter to seller-only listings (THB payment token) when requested */
  private filterSellerListings(listings: any[], sellerOnly: boolean) {
    if (!sellerOnly || !this.thbAddress) return listings;

    const beforeCount = listings.length;
    const filtered = listings.filter(
      (listing) =>
        listing.paymentToken.toLowerCase() === this.thbAddress.toLowerCase(),
    );
    this.logger.log(
      `[GetMarketplaceListingsEndUser] Filtered to ${filtered.length} seller listings (from ${beforeCount}) using THB payment token`,
    );
    return filtered;
  }

  /** Return empty response with or without pagination shape */
  private emptyResponse(page?: number, limit?: number) {
    return page !== undefined && limit !== undefined
      ? { page, limit, total: 0, totalPages: 0, listings: [] }
      : { total: 0, listings: [] };
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

    const detailMap = new Map<string, ListingDetailRow>();
    for (const row of listingDetails) {
      detailMap.set(row.voucherGroupId, row);
    }

    const countMap = new Map<string, number>();
    for (const row of availableCounts) {
      countMap.set(row.voucherGroupId, Number(row.availableCount));
    }

    const codeOwnerMerchantMap =
      await this.fetchCodeOwnerMerchants(listingDetails);

    this.logger.log(
      `[GetMarketplaceListingsEndUser] SQL returned ${listingDetails.length} listing details, ${availableCounts.length} count rows`,
    );

    return { detailMap, countMap, codeOwnerMerchantMap };
  }

  /** Fetch merchant details for code owners different from the voucher merchant */
  private async fetchCodeOwnerMerchants(listingDetails: ListingDetailRow[]) {
    const merchantOwnerIds = new Set<string>();
    for (const row of listingDetails) {
      if (
        row.codeCurrentOwnerType === 'MERCHANT' &&
        row.codeCurrentOwnerId &&
        row.codeCurrentOwnerId !== row.merchantId
      ) {
        merchantOwnerIds.add(row.codeCurrentOwnerId);
      }
    }

    const map = new Map<string, CodeOwnerMerchantRow>();
    if (merchantOwnerIds.size === 0) return map;

    const rows = await this.prisma.$queryRaw<CodeOwnerMerchantRow[]>`
      SELECT
        m.id AS "codeOwnerId",
        m.id AS "merchantId",
        m.name AS "merchantName",
        m."imageUrl" AS "merchantImageUrl",
        w."walletAddress" AS "merchantWalletAddress"
      FROM "Merchant" m
      LEFT JOIN "Wallet" w ON m."walletId" = w.id
      WHERE m.id IN (${Prisma.join([...merchantOwnerIds])})
    `;
    for (const row of rows) {
      map.set(row.codeOwnerId, row);
    }
    return map;
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
    const now = new Date();
    const validListings: any[] = [];

    for (const listing of blockchainListings) {
      const detail = detailMap.get(listing.listingId);
      if (!detail) {
        this.logger.warn(
          `[GetMarketplaceListingsEndUser] ❌ No voucher codes found in database for listingId ${listing.listingId}`,
        );
        continue;
      }

      if (this.isExpiredVoucher(detail, now)) continue;
      if (!this.matchesMerchantFilter(detail, merchantId)) continue;

      const { sellerWalletAddress, actualMerchant } = this.resolveSellerInfo(
        detail,
        codeOwnerMerchantMap,
      );

      const totalAvailableCodes = this.computeAvailableCodes(listing, countMap);
      if (totalAvailableCodes === 0) continue;

      validListings.push(
        this.buildListingEntry(
          listing,
          detail,
          actualMerchant,
          sellerWalletAddress,
          totalAvailableCodes,
          merchantRefMap,
        ),
      );
    }

    return validListings;
  }

  /** Check if voucher is expired by date or status */
  private isExpiredVoucher(detail: ListingDetailRow, now: Date): boolean {
    if (detail.voucherEndDate && new Date(detail.voucherEndDate) < now) {
      return true;
    }
    return (detail.voucherStatus as string) === EXPIRED_STATUS;
  }

  /** Check if listing matches the requested merchantId filter */
  private matchesMerchantFilter(
    detail: ListingDetailRow,
    merchantId?: string,
  ): boolean {
    if (!merchantId) return true;

    const isVoucherOwner = detail.merchantId === merchantId;
    const isSellerMerchant = detail.voucherSellerMerchantId === merchantId;
    const isCodeOwner =
      detail.codeCurrentOwnerId === merchantId &&
      detail.codeCurrentOwnerType === 'MERCHANT';

    return isVoucherOwner || isSellerMerchant || isCodeOwner;
  }

  /** Resolve seller wallet address and actual merchant from detail + code owner map */
  private resolveSellerInfo(
    detail: ListingDetailRow,
    codeOwnerMerchantMap: Map<string, CodeOwnerMerchantRow>,
  ) {
    let sellerWalletAddress = detail.merchantWalletAddress || '';
    let actualMerchant: {
      id: string;
      name: string;
      imageUrl: string | null;
    } | null = detail.merchantId
      ? {
          id: detail.merchantId,
          name: detail.merchantName!,
          imageUrl: detail.merchantImageUrl,
        }
      : null;

    if (
      detail.codeCurrentOwnerType === 'MERCHANT' &&
      detail.codeCurrentOwnerId
    ) {
      const ownerMerchant = codeOwnerMerchantMap.get(detail.codeCurrentOwnerId);
      if (ownerMerchant?.merchantWalletAddress) {
        sellerWalletAddress = ownerMerchant.merchantWalletAddress;
      }
      if (ownerMerchant) {
        actualMerchant = actualMerchant || {
          id: ownerMerchant.merchantId,
          name: ownerMerchant.merchantName,
          imageUrl: ownerMerchant.merchantImageUrl,
        };
      }
    }

    return { sellerWalletAddress, actualMerchant };
  }

  /** Compute total available codes for a listing */
  private computeAvailableCodes(
    listing: any,
    countMap: Map<string, number>,
  ): number {
    const isSellerListing =
      listing.paymentToken.toLowerCase() === this.thbAddress.toLowerCase();
    const dbAvailableCodes = countMap.get(listing.listingId) || 0;
    return isSellerListing ? parseInt(listing.amount, 10) : dbAvailableCodes;
  }

  /** Build a single listing response entry */
  private buildListingEntry(
    listing: any,
    detail: ListingDetailRow,
    actualMerchant: {
      id: string;
      name: string;
      imageUrl: string | null;
    } | null,
    sellerWalletAddress: string,
    totalAvailableCodes: number,
    merchantRefMap: Map<string, any>,
  ) {
    return {
      listingId: listing.listingId,
      seller: listing.seller,
      typeId: listing.typeId,
      amountOnChain: listing.amount,
      totalAvailableCodes,
      pricePerUnit: listing.pricePerUnit,
      paymentToken: listing.paymentToken,
      isActive: listing.isActive,
      listedAt: listing.listedAt,
      voucher: {
        id: detail.voucherId,
        name: detail.voucherName,
        description: detail.voucherDescription,
        imageUrl: detail.voucherImageUrl,
        valueType: detail.voucherValueType,
        value: detail.voucherValue,
        startDate: detail.voucherStartDate,
        endDate: detail.voucherEndDate,
        status: detail.voucherStatus,
        merchantRef: detail.voucherMerchantRef || null,
        merchantRefDetail: detail.voucherMerchantRef
          ? merchantRefMap.get(detail.voucherMerchantRef) || null
          : null,
        merchant: actualMerchant
          ? {
              id: actualMerchant.id,
              name: actualMerchant.name,
              walletAddress: sellerWalletAddress,
              imageUrl: actualMerchant.imageUrl,
            }
          : null,
        point: detail.pointId
          ? {
              id: detail.pointId,
              name: detail.pointName,
              symbol: detail.pointSymbol,
              contractAddress: detail.pointContractAddress
                ? convertBufferToAddress(detail.pointContractAddress as any)
                : null,
              imageUrl: detail.pointImageUrl,
            }
          : null,
      },
    };
  }

  /** Apply pagination if page and limit are provided */
  private paginate(validListings: any[], page?: number, limit?: number) {
    const total = validListings.length;

    if (page !== undefined && limit !== undefined) {
      const startIndex = (page - 1) * limit;
      const paginatedListings = validListings.slice(
        startIndex,
        startIndex + limit,
      );

      this.logger.log(
        `[GetMarketplaceListingsEndUser] Returning page ${page} with ${paginatedListings.length} listings (of ${total})`,
      );

      return {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        listings: paginatedListings,
      };
    }

    this.logger.log(
      `[GetMarketplaceListingsEndUser] Returning ${total} listings (no pagination)`,
    );

    return { total, listings: validListings };
  }
}
