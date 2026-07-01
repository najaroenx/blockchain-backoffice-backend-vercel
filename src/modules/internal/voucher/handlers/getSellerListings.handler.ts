import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { ListingBatchStatus } from '@prisma/client';

export interface ListingBatchSummary {
  id: string;
  name: string | null;
  description: string | null;
  sellerWalletAddress: string;
  totalItems: number;
  soldItems: number;
  remainingItems: number;
  totalValue: number;
  currency: string;
  status: ListingBatchStatus;
  createdAt: Date;
  voucherTypes: number; // Count of unique voucher types in this batch
  valueType: string | null;
  value: number | null;
  thbPrice: number | null;
  imageUrl: string | null;
}

export interface GetSellerListingsResult {
  listings: ListingBatchSummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

@Injectable()
export class GetSellerListingsHandler {
  private readonly logger = new Logger(GetSellerListingsHandler.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(
    sellerWalletAddress: string,
    page: number = 1,
    limit: number = 20,
    status?: ListingBatchStatus,
  ): Promise<GetSellerListingsResult> {
    this.logger.log(
      `[START] Getting listings for seller ${sellerWalletAddress}`,
    );

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      sellerWalletAddress: sellerWalletAddress.toLowerCase(),
    };

    if (status) {
      where.status = status;
    }

    // Get total count
    const total = await this.prisma.listingBatch.count({ where });

    // Get listings with voucher codes grouped by voucherId
    const listings = await this.prisma.listingBatch.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        voucherCodes: {
          select: {
            voucherId: true,
            thbPrice: true,
            voucher: {
              select: {
                name: true,
                valueType: true,
                value: true,
                imageUrl: true,
              },
            },
          },
        },
      },
    });

    // Transform to summary format
    const listingSummaries: ListingBatchSummary[] = listings.map((listing) => {
      // Count unique voucher types
      const uniqueVoucherIds = new Set(
        listing.voucherCodes.map((vc) => vc.voucherId),
      );

      // Get voucher info from first voucher code
      const firstCode = listing.voucherCodes[0];

      return {
        id: listing.id,
        name: firstCode?.voucher?.name,
        description: listing.description,
        sellerWalletAddress: listing.sellerWalletAddress,
        totalItems: listing.totalItems,
        soldItems: listing.soldItems,
        remainingItems: listing.totalItems - listing.soldItems,
        totalValue: listing.totalValue,
        currency: listing.currency,
        status: listing.status,
        createdAt: listing.createdAt,
        voucherTypes: uniqueVoucherIds.size,
        valueType: firstCode?.voucher?.valueType ?? null,
        value: firstCode?.voucher?.value ?? null,
        thbPrice: firstCode?.thbPrice ?? null,
        imageUrl: firstCode?.voucher?.imageUrl ?? null,
      };
    });

    this.logger.log(`[DONE] Found ${listings.length} listings for seller`);

    return {
      listings: listingSummaries,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
