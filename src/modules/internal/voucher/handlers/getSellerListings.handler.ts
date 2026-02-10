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
  private logger = new Logger(GetSellerListingsHandler.name);

  constructor(private prisma: PrismaService) {}

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

      return {
        id: listing.id,
        name: listing.name,
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
