import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class GetSellerVouchers {
  private logger = new Logger(GetSellerVouchers.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get seller vouchers
   * @param merchantId - Merchant ID to find seller wallet and filter vouchers
   */
  async execute(merchantId?: string): Promise<any> {
    try {
      // If merchantId provided, lookup seller wallet address
      let sellerWalletAddress: string | undefined;
      if (merchantId) {
        // Find merchant wallet first
        const merchantWallet = await this.prisma.wallet.findFirst({
          where: {
            merchant: { id: merchantId },
          },
        });

        if (merchantWallet) {
          // Find seller wallet (derivationIndex = merchantWallet.derivationIndex + 1, same phoneNumber)
          const sellerWallet = await this.prisma.wallet.findFirst({
            where: {
              type: 'seller',
              derivationIndex: merchantWallet.derivationIndex + 1,
              phoneNumber: merchantWallet.phoneNumber,
            },
          });

          if (sellerWallet) {
            sellerWalletAddress = sellerWallet.walletAddress;
          }
        }
      }

      this.logger.log(
        `[START] Getting seller vouchers${merchantId ? ` for merchant: ${merchantId}` : ' (all sellers)'}${sellerWalletAddress ? ` (seller wallet: ${sellerWalletAddress})` : ''}`,
      );

      // Build where clause
      const whereClause: any = {
        merchantId: null, // Seller vouchers have no merchant assigned yet
      };

      // If seller wallet address provided, filter by wallet
      // Note: We need to link vouchers to seller wallets somehow
      // For now, we'll just get all seller vouchers (merchantId = null)

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
              availableForSale: voucher.totalIssued - soldCodesCount,
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

      this.logger.log(
        `[SUCCESS] Found ${enhancedVouchers.length} seller vouchers`,
      );

      return {
        count: enhancedVouchers.length,
        vouchers: enhancedVouchers,
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
