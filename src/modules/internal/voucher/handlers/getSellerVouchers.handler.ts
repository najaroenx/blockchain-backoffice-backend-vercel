import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class GetSellerVouchers {
  private logger = new Logger(GetSellerVouchers.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get seller vouchers
   * @param merchantId - Merchant ID to filter vouchers by sellerMerchantId
   */
  async execute(merchantId?: string): Promise<any> {
    try {
      this.logger.log(
        `[START] Getting seller vouchers${merchantId ? ` for merchant: ${merchantId}` : ' (all sellers)'}`,
      );

      // Build where clause - seller vouchers have merchantId = null but sellerMerchantId = merchantId
      const whereClause: any = {
        merchantId: null, // Seller vouchers have no merchant assigned yet (not purchased by marketer)
      };

      // If merchantId provided, filter by sellerMerchantId
      if (merchantId) {
        whereClause.sellerMerchantId = merchantId;
      }

      // Get all seller vouchers (not yet purchased by merchants)
      const vouchers = await this.prisma.voucher.findMany({
        where: whereClause,
        include: {
          voucherCodes: {
            take: 1,
            select: {
              pointsCost: true,
              pointId: true,
              currency: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      // Single raw SQL query to get all counts per voucher (instead of N×3 queries)
      const voucherIds = vouchers.map((v) => v.id);

      const codeStats = voucherIds.length
        ? await this.prisma.$queryRaw<
            {
              voucherId: string;
              totalCodes: bigint;
              listedCodes: bigint;
              soldCodes: bigint;
            }[]
          >`
            SELECT
              "voucherId",
              COUNT(*)::bigint AS "totalCodes",
              COUNT(CASE WHEN "voucherGroupId" IS NOT NULL THEN 1 ELSE NULL END)::bigint AS "listedCodes",
              COUNT(CASE WHEN "currentOwnerId" IS NOT NULL THEN 1 ELSE NULL END)::bigint AS "soldCodes"
            FROM "VoucherCode"
            WHERE "voucherId" IN (${Prisma.join(voucherIds)})
            GROUP BY "voucherId"
          `
        : [];

      const statsMap = new Map(
        codeStats.map((s) => [
          s.voucherId,
          {
            totalCodes: Number(s.totalCodes),
            listedCodes: Number(s.listedCodes),
            soldCodes: Number(s.soldCodes),
          },
        ]),
      );

      // Enhance vouchers with stats from single query
      const enhancedVouchers = vouchers.map((voucher) => {
        const stats = statsMap.get(voucher.id) || {
          totalCodes: 0,
          listedCodes: 0,
          soldCodes: 0,
        };
        const availableForSale =
          voucher.totalIssued - stats.listedCodes - stats.soldCodes;

        const { voucherCodes, ...voucherData } = voucher;

        return {
          ...voucherData,
          pointsCost: voucherCodes[0]?.pointsCost || null,
          pointId: voucherCodes[0]?.pointId || null,
          currency: voucherCodes[0]?.currency || null,
          stats: {
            ...stats,
            availableForSale,
          },
          status: {
            isListed: stats.listedCodes > 0,
            hasSales: stats.soldCodes > 0,
            fullyCreated: stats.totalCodes === voucher.totalIssued,
          },
        };
      });

      const availableVouchers = enhancedVouchers.filter(
        (v) => v.stats.availableForSale > 0,
      );

      this.logger.log(
        `[SUCCESS] Found ${availableVouchers.length}/${enhancedVouchers.length} seller vouchers with available stock`,
      );

      return {
        count: availableVouchers.length,
        vouchers: availableVouchers,
      };
    } catch (error) {
      this.logger.error(
        `[ERROR] Failed to get seller vouchers: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
