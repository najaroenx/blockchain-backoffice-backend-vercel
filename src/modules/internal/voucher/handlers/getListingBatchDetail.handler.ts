import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { ListingBatchStatus } from '@prisma/client';

export interface VoucherTypeInBatch {
  voucherId: string;
  voucherName: string;
  voucherGroupId: string; // Blockchain listing ID
  tokenId: string | null;
  totalAmount: number;
  soldAmount: number;
  remainingAmount: number;
  pricePerUnit: number;
  currency: string;
}

export interface ListingBatchDetail {
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
  updatedAt: Date;
  voucherTypes: VoucherTypeInBatch[];
}

@Injectable()
export class GetListingBatchDetailHandler {
  private logger = new Logger(GetListingBatchDetailHandler.name);

  constructor(private prisma: PrismaService) {}

  async execute(batchId: string): Promise<ListingBatchDetail> {
    this.logger.log(`[START] Getting batch detail for ${batchId}`);

    // Get the listing batch
    const batch = await this.prisma.listingBatch.findUnique({
      where: { id: batchId },
    });

    if (!batch) {
      throw new NotFoundException(`ListingBatch ${batchId} not found`);
    }

    // Get voucher codes grouped by voucherId and voucherGroupId
    const voucherCodes = await this.prisma.voucherCode.findMany({
      where: { listingBatchId: batchId },
      include: {
        voucher: {
          select: {
            id: true,
            name: true,
            tokenId: true,
          },
        },
      },
    });

    // Group voucher codes by voucherId + voucherGroupId
    const groupedMap = new Map<
      string,
      {
        voucherId: string;
        voucherName: string;
        voucherGroupId: string;
        tokenId: string | null;
        pricePerUnit: number;
        currency: string;
        total: number;
        sold: number;
      }
    >();

    for (const code of voucherCodes) {
      const key = `${code.voucherId}-${code.voucherGroupId}`;

      if (!groupedMap.has(key)) {
        groupedMap.set(key, {
          voucherId: code.voucherId,
          voucherName: code.voucher.name,
          voucherGroupId: code.voucherGroupId || '',
          tokenId: code.voucher.tokenId,
          pricePerUnit: code.pointsCost,
          currency: code.currency || 'THB',
          total: 0,
          sold: 0,
        });
      }

      const group = groupedMap.get(key)!;
      group.total += 1;

      // Count as sold if it has an owner
      if (code.currentOwnerId) {
        group.sold += 1;
      }
    }

    // Convert to array
    const voucherTypes: VoucherTypeInBatch[] = Array.from(
      groupedMap.values(),
    ).map((group) => ({
      voucherId: group.voucherId,
      voucherName: group.voucherName,
      voucherGroupId: group.voucherGroupId,
      tokenId: group.tokenId,
      totalAmount: group.total,
      soldAmount: group.sold,
      remainingAmount: group.total - group.sold,
      pricePerUnit: group.pricePerUnit,
      currency: group.currency,
    }));

    this.logger.log(
      `[DONE] Batch ${batchId} has ${voucherTypes.length} voucher types`,
    );

    return {
      id: batch.id,
      name: batch.name,
      description: batch.description,
      sellerWalletAddress: batch.sellerWalletAddress,
      totalItems: batch.totalItems,
      soldItems: batch.soldItems,
      remainingItems: batch.totalItems - batch.soldItems,
      totalValue: batch.totalValue,
      currency: batch.currency,
      status: batch.status,
      createdAt: batch.createdAt,
      updatedAt: batch.updatedAt,
      voucherTypes,
    };
  }
}
