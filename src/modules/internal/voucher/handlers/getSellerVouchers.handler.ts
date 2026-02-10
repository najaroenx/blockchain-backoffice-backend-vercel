import { Injectable, Logger } from '@nestjs/common';
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

      // Enhance with counts and status
      const enhancedVouchers = await Promise.all(
        vouchers.map(async (voucher) => {
          // Count total codes created (not activated yet)
          const totalCodesCount = await this.prisma.voucherCode.count({
            where: { voucherId: voucher.id },
          });

          // Count codes that have been listed on marketplace (have voucherGroupId)
          const listedCodesCount = await this.prisma.voucherCode.count({
            where: {
              voucherId: voucher.id,
              voucherGroupId: { not: null },
            },
          });

          // Count sold codes (have currentOwnerId = merchant)
          const soldCodesCount = await this.prisma.voucherCode.count({
            where: {
              voucherId: voucher.id,
              currentOwnerId: { not: null },
            },
          });

          const { voucherCodes, ...voucherData } = voucher;
          this.logger.log(
            `[INFO] Voucher ID: ${voucher.id} - Total Codes: ${voucher.totalIssued}, Listed: ${listedCodesCount}, Sold: ${soldCodesCount}`,
          );
          return {
            ...voucherData,
            pointsCost: voucherCodes[0]?.pointsCost || null,
            pointId: voucherCodes[0]?.pointId || null,
            currency: voucherCodes[0]?.currency || null,
            // Additional info
            stats: {
              totalCodes: totalCodesCount,
              listedCodes: listedCodesCount,
              soldCodes: soldCodesCount,
              availableForSale:
                voucher.totalIssued - listedCodesCount - soldCodesCount,
            },
            // to do total ทั้งหมดตอนนี้เท่าไหร่ , เหลือเท่าไหร่ total issuee - จำนวนที่ลิส
            status: {
              isListed: listedCodesCount > 0,
              hasSales: soldCodesCount > 0,
              fullyCreated: totalCodesCount === voucher.totalIssued,
            },
          };
        }),
      );

      // Filter only vouchers that still have available codes to list
      const filteredVouchers = enhancedVouchers.filter(
        (v) => v.stats.availableForSale > 0,
      );

      this.logger.log(
        `[SUCCESS] Found ${filteredVouchers.length} listable seller vouchers (filtered from ${enhancedVouchers.length} total)`,
      );

      return {
        count: filteredVouchers.length,
        vouchers: filteredVouchers,
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
