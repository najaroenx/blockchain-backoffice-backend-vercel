import { Prisma } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';
import { convertBufferToAddress } from 'src/libs/convertBufferToAddress';

const EXPIRED_STATUS = 'expired';

export interface ListingDetailRow {
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
  voucherMerchantRef?: string | null;
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

export interface AvailableCountRow {
  voucherGroupId: string;
  availableCount: bigint;
}

export interface CodeOwnerMerchantRow {
  codeOwnerId: string;
  merchantId: string;
  merchantName: string;
  merchantImageUrl: string | null;
  merchantWalletAddress: string | null;
}

interface FetchMarketplaceListingDataOptions {
  pointOnly?: boolean;
  merchantRef?: string;
}

interface BuildMarketplaceListingsOptions {
  blockchainListings: any[];
  detailMap: Map<string, ListingDetailRow>;
  countMap: Map<string, number>;
  codeOwnerMerchantMap: Map<string, CodeOwnerMerchantRow>;
  thbAddress: string;
  merchantId?: string;
  includeMerchantRef?: boolean;
  merchantRefDetailFor?: (detail: ListingDetailRow) => any;
  onMissingDetail?: (listing: any) => void;
  onExpired?: (detail: ListingDetailRow) => void;
  onMerchantFilterMiss?: (detail: ListingDetailRow) => void;
  onSellerMismatch?: (listing: any, sellerWalletAddress: string) => void;
  onSoldOut?: (listing: any) => void;
}

export function emptyMarketplaceResponse(page?: number, limit?: number) {
  return page !== undefined && limit !== undefined
    ? { page, limit, total: 0, totalPages: 0, listings: [] }
    : { total: 0, listings: [] };
}

export function paginateMarketplaceListings(
  listings: any[],
  page?: number,
  limit?: number,
) {
  const total = listings.length;

  if (page !== undefined && limit !== undefined) {
    const startIndex = (page - 1) * limit;
    return {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      listings: listings.slice(startIndex, startIndex + limit),
    };
  }

  return { total, listings };
}

export function filterSellerListings(
  listings: any[],
  sellerOnly: boolean,
  thbAddress: string,
) {
  if (!sellerOnly || !thbAddress) {
    return listings;
  }

  return listings.filter(
    (listing) =>
      listing.paymentToken.toLowerCase() === thbAddress.toLowerCase(),
  );
}

export function mapListingDetails(rows: ListingDetailRow[]) {
  const detailMap = new Map<string, ListingDetailRow>();
  for (const row of rows) {
    detailMap.set(row.voucherGroupId, row);
  }
  return detailMap;
}

export function mapAvailableCounts(rows: AvailableCountRow[]) {
  const countMap = new Map<string, number>();
  for (const row of rows) {
    countMap.set(row.voucherGroupId, Number(row.availableCount));
  }
  return countMap;
}

export async function fetchMarketplaceListingData(
  prisma: PrismaService,
  listingIds: string[],
  options: FetchMarketplaceListingDataOptions = {},
) {
  const listingDetails = await prisma.$queryRaw<ListingDetailRow[]>`
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
      ${
        options.pointOnly
          ? Prisma.sql`AND vc."pointId" IS NOT NULL`
          : Prisma.empty
      }
      ${
        options.merchantRef
          ? Prisma.sql`AND v."merchantRef" = ${options.merchantRef}`
          : Prisma.empty
      }
      AND (vc."currentOwnerType" IS NULL OR vc."currentOwnerType" != 'CUSTOMER')
    ORDER BY vc."voucherGroupId", vc.created_at ASC
  `;

  const detailMap = mapListingDetails(listingDetails);
  if (listingDetails.length === 0) {
    return {
      detailMap,
      countMap: new Map<string, number>(),
      codeOwnerMerchantMap: new Map<string, CodeOwnerMerchantRow>(),
      listingDetailsCount: 0,
      availableCountsCount: 0,
    };
  }

  const filteredListingIds = listingDetails.map(
    (detail) => detail.voucherGroupId,
  );
  const availableCounts = await prisma.$queryRaw<AvailableCountRow[]>`
    SELECT
      vc."voucherGroupId",
      COUNT(*)::bigint AS "availableCount"
    FROM "VoucherCode" vc
    WHERE vc."voucherGroupId" IN (${Prisma.join(filteredListingIds)})
      AND vc."isUsed" = false
      AND (vc."currentOwnerType" IS NULL OR vc."currentOwnerType" != 'CUSTOMER')
    GROUP BY vc."voucherGroupId"
  `;

  return {
    detailMap,
    countMap: mapAvailableCounts(availableCounts),
    codeOwnerMerchantMap: await fetchCodeOwnerMerchants(prisma, listingDetails),
    listingDetailsCount: listingDetails.length,
    availableCountsCount: availableCounts.length,
  };
}

export async function fetchCodeOwnerMerchants(
  prisma: PrismaService,
  listingDetails: ListingDetailRow[],
) {
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
  if (merchantOwnerIds.size === 0) {
    return map;
  }

  const rows = await prisma.$queryRaw<CodeOwnerMerchantRow[]>`
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

export function buildMarketplaceListings({
  blockchainListings,
  detailMap,
  countMap,
  codeOwnerMerchantMap,
  thbAddress,
  merchantId,
  includeMerchantRef = false,
  merchantRefDetailFor,
  onMissingDetail,
  onExpired,
  onMerchantFilterMiss,
  onSellerMismatch,
  onSoldOut,
}: BuildMarketplaceListingsOptions) {
  const now = new Date();
  const validListings: any[] = [];

  for (const listing of blockchainListings) {
    const detail = detailMap.get(listing.listingId);
    if (!detail) {
      onMissingDetail?.(listing);
      continue;
    }

    if (isExpiredVoucher(detail, now)) {
      onExpired?.(detail);
      continue;
    }

    if (!matchesMerchantFilter(detail, merchantId)) {
      onMerchantFilterMiss?.(detail);
      continue;
    }

    const { sellerWalletAddress, actualMerchant } = resolveSellerInfo(
      detail,
      codeOwnerMerchantMap,
    );

    if (sellerWalletAddress.toLowerCase() !== listing.seller.toLowerCase()) {
      onSellerMismatch?.(listing, sellerWalletAddress);
    }

    const totalAvailableCodes = computeAvailableCodes(
      listing,
      countMap,
      thbAddress,
    );
    if (totalAvailableCodes === 0) {
      onSoldOut?.(listing);
      continue;
    }

    validListings.push(
      buildListingEntry({
        listing,
        detail,
        actualMerchant,
        sellerWalletAddress,
        totalAvailableCodes,
        includeMerchantRef,
        merchantRefDetail: merchantRefDetailFor?.(detail),
      }),
    );
  }

  return validListings;
}

function isExpiredVoucher(detail: ListingDetailRow, now: Date): boolean {
  if (detail.voucherEndDate && new Date(detail.voucherEndDate) < now) {
    return true;
  }
  return detail.voucherStatus?.toLowerCase() === EXPIRED_STATUS;
}

function matchesMerchantFilter(
  detail: ListingDetailRow,
  merchantId?: string,
): boolean {
  if (!merchantId) {
    return true;
  }

  const isVoucherOwner = detail.merchantId === merchantId;
  const isSellerMerchant = detail.voucherSellerMerchantId === merchantId;
  const isCodeOwner =
    detail.codeCurrentOwnerId === merchantId &&
    detail.codeCurrentOwnerType === 'MERCHANT';

  return isVoucherOwner || isSellerMerchant || isCodeOwner;
}

function resolveSellerInfo(
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

  if (detail.codeCurrentOwnerType === 'MERCHANT' && detail.codeCurrentOwnerId) {
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

function computeAvailableCodes(
  listing: any,
  countMap: Map<string, number>,
  thbAddress: string,
): number {
  const isSellerListing =
    listing.paymentToken.toLowerCase() === thbAddress.toLowerCase();
  const dbAvailableCodes = countMap.get(listing.listingId) || 0;
  return isSellerListing ? parseInt(listing.amount, 10) : dbAvailableCodes;
}

function buildListingEntry({
  listing,
  detail,
  actualMerchant,
  sellerWalletAddress,
  totalAvailableCodes,
  includeMerchantRef,
  merchantRefDetail,
}: {
  listing: any;
  detail: ListingDetailRow;
  actualMerchant: {
    id: string;
    name: string;
    imageUrl: string | null;
  } | null;
  sellerWalletAddress: string;
  totalAvailableCodes: number;
  includeMerchantRef: boolean;
  merchantRefDetail: any;
}) {
  const voucher: Record<string, any> = {
    id: detail.voucherId,
    name: detail.voucherName,
    description: detail.voucherDescription,
    imageUrl: detail.voucherImageUrl,
    valueType: detail.voucherValueType,
    value: detail.voucherValue,
    startDate: detail.voucherStartDate,
    endDate: detail.voucherEndDate,
    status: detail.voucherStatus,
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
  };

  if (includeMerchantRef) {
    voucher.merchantRef = detail.voucherMerchantRef || null;
    voucher.merchantRefDetail = detail.voucherMerchantRef
      ? merchantRefDetail || null
      : null;
  }

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
    voucher,
  };
}
