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

      // 1. Get all active listings from marketplace smart contract
      const blockchainListings =
        await this.blockchainService.getAllActiveMarketplaceListings();

      this.logger.log(
        `[GetMarketplaceListingsByMerchantRef] Found ${blockchainListings.length} active listings on blockchain`,
      );

      if (blockchainListings.length === 0) {
        return page !== undefined && limit !== undefined
          ? { page, limit, total: 0, totalPages: 0, listings: [] }
          : { total: 0, listings: [] };
      }

      const listingIds = blockchainListings.map((l) => l.listingId);

      // 2. Get one sample voucher code per listing filtered by merchantRef
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

      if (listingDetails.length === 0) {
        this.logger.log(
          `[GetMarketplaceListingsByMerchantRef] No listings found for merchantRef=${merchantRef}`,
        );
        return page !== undefined && limit !== undefined
          ? { page, limit, total: 0, totalPages: 0, listings: [] }
          : { total: 0, listings: [] };
      }

      // 3. Get available code counts per listing (also filtered by merchantRef)
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

      // Index results by listingId for O(1) lookup
      const detailMap = new Map<string, ListingDetailRow>();
      for (const row of listingDetails) {
        detailMap.set(row.voucherGroupId, row);
      }

      const countMap = new Map<string, number>();
      for (const row of availableCounts) {
        countMap.set(row.voucherGroupId, Number(row.availableCount));
      }

      // 4. Collect unique MERCHANT code owners that need wallet lookup
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

      const codeOwnerMerchantMap = new Map<string, CodeOwnerMerchantRow>();
      if (merchantOwnerIds.size > 0) {
        const codeOwnerMerchants = await this.prisma.$queryRaw<
          CodeOwnerMerchantRow[]
        >`
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
        for (const row of codeOwnerMerchants) {
          codeOwnerMerchantMap.set(row.codeOwnerId, row);
        }
      }

      this.logger.log(
        `[GetMarketplaceListingsByMerchantRef] SQL returned ${listingDetails.length} listing details for merchantRef=${merchantRef}`,
      );

      // 5. Enrich merchantRef details
      const merchantRefDetail =
        await this.merchantRefEnrichment.enrich(merchantRef);

      // 6. Build results by mapping blockchain listings to DB data
      const now = new Date();
      const validListings: any[] = [];

      for (const listing of blockchainListings) {
        const detail = detailMap.get(listing.listingId);
        if (!detail) continue;

        // Filter out expired vouchers
        if (detail.voucherEndDate && new Date(detail.voucherEndDate) < now) {
          continue;
        }
        if ((detail.voucherStatus as string) === EXPIRED_STATUS) {
          continue;
        }

        // Determine seller wallet and actual merchant
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
          const ownerMerchant = codeOwnerMerchantMap.get(
            detail.codeCurrentOwnerId,
          );
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

        // Determine available codes
        const isSellerListing =
          listing.paymentToken.toLowerCase() === this.thbAddress.toLowerCase();
        const dbAvailableCodes = countMap.get(listing.listingId) || 0;
        const totalAvailableCodes = isSellerListing
          ? parseInt(listing.amount, 10)
          : dbAvailableCodes;

        if (totalAvailableCodes === 0) continue;

        validListings.push({
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
        });
      }

      this.logger.log(
        `[GetMarketplaceListingsByMerchantRef] Found ${validListings.length} valid listings for merchantRef=${merchantRef}`,
      );

      // Apply pagination if requested
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
    } catch (error) {
      this.logger.error(
        `[GetMarketplaceListingsByMerchantRef] Failed: ${error.message}`,
      );
      throw error;
    }
  }
}
