import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';
import { TransactionTypeId } from 'src/constants/transaction-types.enum';
import { AssetType } from '@prisma/client';
import { DashboardQueryDto } from '../dtos/dashboard-query.dto';
import {
  SellerDashboardResponse,
  SellerOverallSummary,
  SellerMerchantBreakdown,
  DateRangeInfo,
} from '../types/dashboard.types';
import { startOfMonth, endOfDay, startOfDay, format } from 'date-fns';

@Injectable()
export class GetSellerDashboardHandler {
  private logger = new Logger(GetSellerDashboardHandler.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(
    merchantId: string,
    query: DashboardQueryDto,
  ): Promise<SellerDashboardResponse> {
    try {
      this.logger.log(
        `[START] Getting seller dashboard for merchant: ${merchantId}`,
      );

      const dateRange = this.parseDateRange(query);

      // 1. Find seller wallet from merchantId (same pattern as batchListOnMarketplace)
      const merchantWallet = await this.prisma.wallet.findFirst({
        where: {
          merchant: { id: merchantId },
        },
        select: {
          phoneNumber: true,
          derivationIndex: true,
        },
      });

      if (!merchantWallet) {
        this.logger.log(`[INFO] Merchant wallet not found for ${merchantId}`);
        return { dateRange, ...this.getEmptyResponse() };
      }

      // Find seller wallet (derivationIndex + 1, same phoneNumber)
      const sellerWallet = await this.prisma.wallet.findFirst({
        where: {
          phoneNumber: merchantWallet.phoneNumber,
          derivationIndex: merchantWallet.derivationIndex + 1,
          type: 'seller',
        },
        select: {
          walletAddress: true,
        },
      });

      if (!sellerWallet) {
        this.logger.log(
          `[INFO] Seller wallet not found for merchant ${merchantId}`,
        );
        return { dateRange, ...this.getEmptyResponse() };
      }

      const sellerWalletAddress = sellerWallet.walletAddress.toLowerCase();
      this.logger.log(`[INFO] Found seller wallet: ${sellerWalletAddress}`);

      // Debug: Check all ListingBatches in DB
      const allListingBatches = await this.prisma.listingBatch.findMany({
        select: { id: true, sellerWalletAddress: true },
        take: 10,
      });
      this.logger.log(
        `[DEBUG] Sample ListingBatches in DB: ${JSON.stringify(allListingBatches)}`,
      );

      // 2. Get ALL voucher codes from:
      // - Strategy 1: Vouchers with sellerMerchantId = merchantId (seller created voucher)
      // - Strategy 2: VoucherCodes in ListingBatch with sellerWalletAddress (seller listed on marketplace)

      // Strategy 1: Vouchers created by seller
      const vouchersFromSeller = await this.prisma.voucher.findMany({
        where: { sellerMerchantId: merchantId },
        select: { id: true },
      });
      const voucherIdsFromSeller = vouchersFromSeller.map((v) => v.id);
      this.logger.log(
        `[DEBUG] Vouchers with sellerMerchantId: ${voucherIdsFromSeller.length}`,
      );

      // Strategy 2: ListingBatches from seller wallet
      const listingBatches = await this.prisma.listingBatch.findMany({
        where: {
          sellerWalletAddress: {
            equals: sellerWalletAddress,
            mode: 'insensitive',
          },
        },
        select: { id: true },
      });
      const listingBatchIds = listingBatches.map((lb) => lb.id);
      this.logger.log(
        `[DEBUG] ListingBatches from seller: ${listingBatchIds.length}`,
      );

      // Get all voucher codes from both strategies
      const allVoucherCodes = await this.prisma.voucherCode.findMany({
        where: {
          OR: [
            // Codes from vouchers created by seller
            ...(voucherIdsFromSeller.length > 0
              ? [{ voucherId: { in: voucherIdsFromSeller } }]
              : []),
            // Codes listed by seller on marketplace
            ...(listingBatchIds.length > 0
              ? [{ listingBatchId: { in: listingBatchIds } }]
              : []),
          ],
        },
        select: {
          id: true,
          thbPrice: true,
          isUsed: true,
          listingBatchId: true,
          voucher: {
            select: {
              thbPurchasePrice: true,
            },
          },
        },
      });

      this.logger.log(
        `[DEBUG] Total voucher codes found: ${allVoucherCodes.length}`,
      );

      if (allVoucherCodes.length === 0) {
        this.logger.log(`[INFO] No voucher codes found for seller`);
        return { dateRange, ...this.getEmptyResponse() };
      }

      // Separate unsold (no listingBatchId) and sold (has listingBatchId)
      const unsoldCodes = allVoucherCodes.filter((vc) => !vc.listingBatchId);
      const soldCodes = allVoucherCodes.filter((vc) => vc.listingBatchId);
      const soldCodeIds = soldCodes.map((vc) => vc.id);

      // 3. Get THB_BUY transactions (marketer bought from seller) - ALL-TIME
      // These indicate "reserved" codes
      const thbBuyTransactions = await this.prisma.transaction.findMany({
        where: {
          transactionTypeId: TransactionTypeId.THB_BUY,
          type: AssetType.THB_TOKEN,
          voucherCodeId: { in: soldCodeIds },
        },
        select: {
          merchantId: true,
          voucherCodeId: true,
          amount: true,
        },
      });

      // Build map: voucherCodeId -> merchantId (who bought it)
      const reservedCodeMap = new Map<string, string>();
      for (const tx of thbBuyTransactions) {
        if (tx.voucherCodeId && tx.merchantId) {
          reservedCodeMap.set(tx.voucherCodeId, tx.merchantId);
        }
      }

      // 4. Get merchant info for breakdown
      const merchantIds = [...new Set(reservedCodeMap.values())];
      const merchants = await this.prisma.merchant.findMany({
        where: { id: { in: merchantIds } },
        select: { id: true, name: true },
      });
      const merchantMap = new Map(merchants.map((m) => [m.id, m.name]));

      // 5. Calculate statistics with new logic
      const overallSummary = this.calculateOverallSummary(
        allVoucherCodes,
        reservedCodeMap,
      );

      const merchantBreakdown = this.calculateMerchantBreakdown(
        soldCodes,
        reservedCodeMap,
        merchantMap,
      );

      this.logger.log(
        `[SUCCESS] Seller dashboard retrieved for merchant: ${merchantId}`,
      );

      return {
        dateRange,
        overallSummary,
        merchants: merchantBreakdown,
      };
    } catch (error) {
      this.logger.error(
        `[ERROR] Failed to get seller dashboard: ${error.message}`,
        error.stack,
      );

      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }

  private parseDateRange(query: DashboardQueryDto): DateRangeInfo {
    const now = new Date();
    const startDate = query.startDate
      ? startOfDay(new Date(query.startDate))
      : startOfMonth(now);
    const endDate = query.endDate
      ? endOfDay(new Date(query.endDate))
      : endOfDay(now);

    return {
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd'),
    };
  }

  private getEmptyResponse(): Omit<SellerDashboardResponse, 'dateRange'> {
    return {
      overallSummary: {
        couponCount: {
          total: 0,
          unsold: 0,
          sold: 0,
          unreserved: 0,
          reserved: 0,
          unredeemed: 0,
          redeemed: 0,
        },
        couponValue: {
          unsold: 0,
          sold: 0,
          unreserved: 0,
          reserved: 0,
          unredeemed: 0,
          redeemed: 0,
        },
      },
      merchants: [],
    };
  }

  /**
   * Calculate overall summary across all voucher codes
   *
   * Logic (hierarchical):
   * - total = unsold + sold (คูปองทั้งหมดที่ seller มี)
   * - unsold = ยังไม่ list on marketplace (ไม่มี listingBatchId)
   * - sold = list on marketplace แล้ว = unreserved + reserved
   * - unreserved = list แล้วแต่ Marketer ยังไม่ซื้อ (ไม่มี THB_BUY)
   * - reserved = Marketer ซื้อแล้ว = unredeemed + redeemed
   * - unredeemed = Marketer ซื้อแล้วแต่ End User ยังไม่ redeem
   * - redeemed = End User redeem แล้ว (isUsed = true)
   */
  private calculateOverallSummary(
    voucherCodes: Array<{
      id: string;
      thbPrice: number | null;
      isUsed: boolean;
      listingBatchId: string | null;
      voucher: {
        thbPurchasePrice: number | null;
      } | null;
    }>,
    reservedCodeMap: Map<string, string>, // voucherCodeId -> merchantId
  ): SellerOverallSummary {
    let unsold = 0;
    let sold = 0;
    let unreserved = 0;
    let reserved = 0;
    let unredeemed = 0;
    let redeemed = 0;

    let unsoldValue = 0;
    let soldValue = 0;
    let unreservedValue = 0;
    let reservedValue = 0;
    let unredeemedValue = 0;
    let redeemedValue = 0;

    for (const vc of voucherCodes) {
      const price = vc.thbPrice ?? vc.voucher?.thbPurchasePrice ?? 0;
      const isListed = vc.listingBatchId !== null;
      const isReserved = reservedCodeMap.has(vc.id);
      const isRedeemed = vc.isUsed;

      if (!isListed) {
        // ยังไม่ list on marketplace
        unsold++;
        unsoldValue += price;
      } else {
        // List on marketplace แล้ว
        sold++;
        soldValue += price;

        if (!isReserved) {
          // List แล้วแต่ Marketer ยังไม่ซื้อ
          unreserved++;
          unreservedValue += price;
        } else {
          // Marketer ซื้อแล้ว
          reserved++;
          reservedValue += price;

          if (!isRedeemed) {
            // End User ยังไม่ redeem
            unredeemed++;
            unredeemedValue += price;
          } else {
            // End User redeem แล้ว
            redeemed++;
            redeemedValue += price;
          }
        }
      }
    }

    const total = unsold + sold;

    return {
      couponCount: {
        total,
        unsold,
        sold,
        unreserved,
        reserved,
        unredeemed,
        redeemed,
      },
      couponValue: {
        unsold: unsoldValue,
        sold: soldValue,
        unreserved: unreservedValue,
        reserved: reservedValue,
        unredeemed: unredeemedValue,
        redeemed: redeemedValue,
      },
    };
  }

  /**
   * Calculate breakdown per merchant who bought from seller
   * Only includes reserved codes (codes that Marketer bought)
   */
  private calculateMerchantBreakdown(
    soldCodes: Array<{
      id: string;
      thbPrice: number | null;
      isUsed: boolean;
      listingBatchId: string | null;
      voucher: { thbPurchasePrice: number | null } | null;
    }>,
    reservedCodeMap: Map<string, string>, // voucherCodeId -> merchantId
    merchantMap: Map<string, string>, // merchantId -> name
  ): SellerMerchantBreakdown[] {
    // Group voucher codes by merchant (only reserved codes)
    const merchantGroups = new Map<
      string,
      Array<{
        id: string;
        thbPrice: number | null;
        isUsed: boolean;
        voucher: { thbPurchasePrice: number | null } | null;
      }>
    >();

    for (const vc of soldCodes) {
      const merchantId = reservedCodeMap.get(vc.id);
      if (!merchantId) continue; // Skip unreserved codes

      if (!merchantGroups.has(merchantId)) {
        merchantGroups.set(merchantId, []);
      }
      merchantGroups.get(merchantId)!.push(vc);
    }

    // Calculate stats per merchant
    const result: SellerMerchantBreakdown[] = [];

    for (const [merchantId, codes] of merchantGroups) {
      let unredeemed = 0;
      let redeemed = 0;
      let unredeemedValue = 0;
      let redeemedValue = 0;

      for (const vc of codes) {
        const price = vc.thbPrice ?? vc.voucher?.thbPurchasePrice ?? 0;
        const isRedeemed = vc.isUsed;

        if (!isRedeemed) {
          unredeemed++;
          unredeemedValue += price;
        } else {
          redeemed++;
          redeemedValue += price;
        }
      }

      const totalValue = codes.reduce(
        (sum, vc) => sum + (vc.thbPrice ?? vc.voucher?.thbPurchasePrice ?? 0),
        0,
      );

      result.push({
        merchantId,
        merchantName: merchantMap.get(merchantId) || 'Unknown',
        couponCount: {
          total: codes.length,
          unsold: 0, // All codes here are sold (listed)
          sold: codes.length, // All codes here are sold (listed) and reserved
          unreserved: 0, // All codes in this group are reserved by this merchant
          reserved: codes.length,
          unredeemed,
          redeemed,
        },
        couponValue: {
          unsold: 0, // All codes here are sold (listed)
          sold: totalValue,
          unreserved: 0,
          reserved: totalValue,
          unredeemed: unredeemedValue,
          redeemed: redeemedValue,
        },
      });
    }

    // Sort by reserved value descending
    result.sort((a, b) => b.couponValue.reserved - a.couponValue.reserved);

    return result;
  }
}
