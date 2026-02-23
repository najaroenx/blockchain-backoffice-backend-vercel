import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';
import { PrismaService } from 'prisma/prisma.service';
import { convertBufferToAddress } from 'src/libs/convertBufferToAddress';
import { MerchantRefEnrichmentService } from 'src/modules/shared/services/merchant-ref-enrichment.service';

const EXPIRED_STATUS = 'expired' as const;

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
        return this.emptyResponse(page, limit);
      }

      const listingIds = blockchainListings.map((l) => l.listingId);
      const { detailMap, countMap, codeOwnerMerchantMap } =
        await this.fetchListingData(listingIds, merchantRef);

      if (detailMap.size === 0) {
        this.logger.log(
          `[GetMarketplaceListingsByMerchantRef] No listings found for merchantRef=${merchantRef}`,
        );
        return this.emptyResponse(page, limit);
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

  /** Return empty response with or without pagination shape */
  private emptyResponse(page?: number, limit?: number) {
    return page !== undefined && limit !== undefined
      ? { page, limit, total: 0, totalPages: 0, listings: [] }
      : { total: 0, listings: [] };
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

    const detailMap = new Map<string, ListingDetailRow>();
    for (const row of listingDetails) {
      detailMap.set(row.voucherGroupId, row);
    }

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

    const countMap = new Map<string, number>();
    for (const row of availableCounts) {
      countMap.set(row.voucherGroupId, Number(row.availableCount));
    }

    const codeOwnerMerchantMap =
      await this.fetchCodeOwnerMerchants(listingDetails);

    this.logger.log(
      `[GetMarketplaceListingsByMerchantRef] SQL returned ${listingDetails.length} listing details for merchantRef=${merchantRef}`,
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

  /** Build valid listings by mapping blockchain data to DB data */
  private buildValidListings(
    blockchainListings: any[],
    detailMap: Map<string, ListingDetailRow>,
    countMap: Map<string, number>,
    codeOwnerMerchantMap: Map<string, CodeOwnerMerchantRow>,
    merchantRefDetail: any,
  ) {
    const now = new Date();
    const validListings: any[] = [];

    for (const listing of blockchainListings) {
      const detail = detailMap.get(listing.listingId);
      if (!detail) continue;
      if (this.isExpiredVoucher(detail, now)) continue;

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
          merchantRefDetail,
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
    merchantRefDetail: any,
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
        merchantRefDetail: merchantRefDetail || null,
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

      return {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        listings: paginatedListings,
      };
    }

    return { total, listings: validListings };
  }
}
