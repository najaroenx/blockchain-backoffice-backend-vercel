import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';
import { TransactionTypeId } from 'src/constants/transaction-types.enum';
import { AssetType, ParticipantType } from '@prisma/client';
import { DashboardQueryDto } from '../dtos/dashboard-query.dto';
import {
  SellerDashboardResponse,
  SellerOverallSummary,
  SellerMerchantBreakdown,
  SellerCouponCount,
  DateRangeInfo,
} from '../types/dashboard.types';
import { startOfMonth, endOfDay, startOfDay, format } from 'date-fns';

@Injectable()
export class GetSellerDashboardHandler {
  private logger = new Logger(GetSellerDashboardHandler.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(
    walletAddress: string,
    query: DashboardQueryDto,
  ): Promise<SellerDashboardResponse> {
    try {
      this.logger.log(
        `[START] Getting seller dashboard for wallet: ${walletAddress}`,
      );

      const normalizedWallet = walletAddress.toLowerCase();
      const dateRange = this.parseDateRange(query);
      const startDate = new Date(dateRange.startDate);
      const endDate = new Date(dateRange.endDate);

      // Get all listing batches for this seller (ALL-TIME for total/owned)
      const listingBatches = await this.prisma.listingBatch.findMany({
        where: {
          sellerWalletAddress: normalizedWallet,
        },
        select: {
          id: true,
          totalItems: true,
          soldItems: true,
          totalValue: true,
          currency: true,
        },
      });

      const listingBatchIds = listingBatches.map((b) => b.id);

      if (listingBatchIds.length === 0) {
        this.logger.log(
          `[INFO] No listing batches found for seller ${walletAddress}`,
        );
        return { dateRange, ...this.getEmptyResponse() };
      }

      // Get all voucher codes from seller's listing batches (ALL-TIME)
      const voucherCodes = await this.prisma.voucherCode.findMany({
        where: {
          listingBatchId: { in: listingBatchIds },
        },
        select: {
          id: true,
          thbPrice: true,
          currentOwnerId: true,
          isUsed: true,
          listingBatchId: true,
          voucher: {
            select: {
              merchantId: true,
              thbPurchasePrice: true,
            },
          },
        },
      });

      // Get merchant info for vouchers that have been sold
      const merchantIds = [
        ...new Set(
          voucherCodes
            .map((vc) => vc.voucher?.merchantId)
            .filter((id): id is string => id !== null && id !== undefined),
        ),
      ];

      const merchants = await this.prisma.merchant.findMany({
        where: { id: { in: merchantIds } },
        select: { id: true, name: true },
      });

      const merchantMap = new Map(merchants.map((m) => [m.id, m.name]));

      // Get TRANSFER+VOUCHER transactions (merchant to customer sales) - FILTERED BY DATE
      const transferTransactions = await this.prisma.transaction.findMany({
        where: {
          transactionTypeId: TransactionTypeId.TRANSFER,
          type: AssetType.VOUCHER,
          senderType: ParticipantType.MERCHANT,
          receiverType: ParticipantType.CUSTOMER,
          voucherCodeId: { in: voucherCodes.map((vc) => vc.id) },
          createdAt: { gte: startDate, lte: endDate },
        },
        select: {
          id: true,
          merchantId: true,
          voucherCodeId: true,
          amount: true,
        },
      });

      // Get REDEEM transactions - FILTERED BY DATE
      const redeemTransactions = await this.prisma.transaction.findMany({
        where: {
          transactionTypeId: TransactionTypeId.REDEEM,
          type: AssetType.VOUCHER,
          voucherCodeId: { in: voucherCodes.map((vc) => vc.id) },
          createdAt: { gte: startDate, lte: endDate },
        },
        select: {
          id: true,
          merchantId: true,
          voucherCodeId: true,
          amount: true,
        },
      });

      // Get THB_BUY transactions (merchant bought from seller) - FILTERED BY DATE
      const thbBuyTransactions = await this.prisma.transaction.findMany({
        where: {
          transactionTypeId: TransactionTypeId.THB_BUY,
          type: AssetType.THB_TOKEN,
          voucherCodeId: { in: voucherCodes.map((vc) => vc.id) },
          createdAt: { gte: startDate, lte: endDate },
        },
        select: {
          id: true,
          merchantId: true,
          voucherCodeId: true,
          amount: true,
        },
      });

      // Build sets for lookup
      const soldVoucherCodeIds = new Set(
        thbBuyTransactions.map((tx) => tx.voucherCodeId),
      );
      const transferredVoucherCodeIds = new Set(
        transferTransactions.map((tx) => tx.voucherCodeId),
      );
      const redeemedVoucherCodeIds = new Set(
        redeemTransactions.map((tx) => tx.voucherCodeId),
      );

      // Calculate overall summary
      const overallSummary = this.calculateOverallSummary(
        voucherCodes,
        listingBatches,
        soldVoucherCodeIds,
        transferredVoucherCodeIds,
        redeemedVoucherCodeIds,
      );

      // Calculate per-merchant breakdown
      const merchantBreakdown = this.calculateMerchantBreakdown(
        voucherCodes,
        merchantMap,
        soldVoucherCodeIds,
        redeemedVoucherCodeIds,
      );

      this.logger.log(
        `[SUCCESS] Seller dashboard retrieved for wallet: ${walletAddress}`,
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
          owned: 0,
          sold: 0,
          reservedByMarketer: 0,
          redeemedByEndUser: 0,
        },
        couponValue: {
          total: 0,
          owned: 0,
          sold: 0,
          reservedByMarketer: 0,
          redeemedByEndUser: 0,
        },
      },
      merchants: [],
    };
  }

  /**
   * Calculate overall summary across all voucher codes
   * - total/owned: ALL-TIME
   * - sold/reservedByMarketer/redeemedByEndUser: FILTERED BY DATE RANGE
   */
  private calculateOverallSummary(
    voucherCodes: Array<{
      id: string;
      thbPrice: number | null;
      currentOwnerId: string | null;
      isUsed: boolean;
      voucher: {
        merchantId: string | null;
        thbPurchasePrice: number | null;
      } | null;
    }>,
    listingBatches: Array<{
      totalItems: number;
      totalValue: number;
    }>,
    soldVoucherCodeIds: Set<string | null>,
    transferredVoucherCodeIds: Set<string | null>,
    redeemedVoucherCodeIds: Set<string | null>,
  ): SellerOverallSummary {
    // Total from listing batches (ALL-TIME)
    const totalCount = listingBatches.reduce((sum, b) => sum + b.totalItems, 0);
    const totalValue = listingBatches.reduce((sum, b) => sum + b.totalValue, 0);

    // Calculate owned (ALL-TIME) - vouchers not yet sold to any merchant
    let ownedCount = 0;
    let ownedValue = 0;

    // Calculate date-filtered stats
    let soldCount = 0;
    let soldValue = 0;
    let reservedByMarketerCount = 0;
    let reservedByMarketerValue = 0;
    let redeemedByEndUserCount = 0;
    let redeemedByEndUserValue = 0;

    for (const vc of voucherCodes) {
      const price = vc.thbPrice ?? vc.voucher?.thbPurchasePrice ?? 0;
      const hasMerchant = vc.voucher?.merchantId !== null;

      if (!hasMerchant) {
        // Still owned by seller (ALL-TIME count)
        ownedCount++;
        ownedValue += price;
      }

      // Check if sold in date range
      if (soldVoucherCodeIds.has(vc.id)) {
        soldCount++;
        soldValue += price;

        // Check redemption status in date range
        if (redeemedVoucherCodeIds.has(vc.id)) {
          redeemedByEndUserCount++;
          redeemedByEndUserValue += price;
        } else {
          // Merchant still holds it (not redeemed in date range)
          reservedByMarketerCount++;
          reservedByMarketerValue += price;
        }
      }
    }

    return {
      couponCount: {
        total: totalCount,
        owned: ownedCount,
        sold: soldCount,
        reservedByMarketer: reservedByMarketerCount,
        redeemedByEndUser: redeemedByEndUserCount,
      },
      couponValue: {
        total: totalValue,
        owned: ownedValue,
        sold: soldValue,
        reservedByMarketer: reservedByMarketerValue,
        redeemedByEndUser: redeemedByEndUserValue,
      },
    };
  }

  /**
   * Calculate breakdown per merchant who bought from seller
   */
  private calculateMerchantBreakdown(
    voucherCodes: Array<{
      id: string;
      thbPrice: number | null;
      currentOwnerId: string | null;
      isUsed: boolean;
      voucher: {
        merchantId: string | null;
        thbPurchasePrice: number | null;
      } | null;
    }>,
    merchantMap: Map<string, string>,
    soldVoucherCodeIds: Set<string | null>,
    redeemedVoucherCodeIds: Set<string | null>,
  ): SellerMerchantBreakdown[] {
    // Group voucher codes by merchant (only those sold in date range)
    const merchantGroups = new Map<
      string,
      {
        codes: typeof voucherCodes;
        name: string;
      }
    >();

    for (const vc of voucherCodes) {
      const merchantId = vc.voucher?.merchantId;
      if (!merchantId) continue; // Skip codes not sold to merchants
      if (!soldVoucherCodeIds.has(vc.id)) continue; // Skip if not sold in date range

      if (!merchantGroups.has(merchantId)) {
        merchantGroups.set(merchantId, {
          codes: [],
          name: merchantMap.get(merchantId) || 'Unknown',
        });
      }
      merchantGroups.get(merchantId)!.codes.push(vc);
    }

    // Calculate stats per merchant
    const result: SellerMerchantBreakdown[] = [];

    for (const [merchantId, group] of merchantGroups) {
      const couponCount: SellerCouponCount = {
        total: group.codes.length,
        owned: 0, // For merchant view, "owned by seller" is 0 since these are already sold
        sold: group.codes.length,
        reservedByMarketer: 0,
        redeemedByEndUser: 0,
      };

      let totalValue = 0;
      let reservedByMarketerValue = 0;
      let redeemedByEndUserValue = 0;

      for (const vc of group.codes) {
        const price = vc.thbPrice ?? vc.voucher?.thbPurchasePrice ?? 0;
        totalValue += price;

        const isRedeemed = redeemedVoucherCodeIds.has(vc.id);

        if (isRedeemed) {
          couponCount.redeemedByEndUser++;
          redeemedByEndUserValue += price;
        } else {
          couponCount.reservedByMarketer++;
          reservedByMarketerValue += price;
        }
      }

      result.push({
        merchantId,
        merchantName: group.name,
        couponCount,
        couponValue: {
          total: totalValue,
          owned: 0,
          sold: totalValue,
          reservedByMarketer: reservedByMarketerValue,
          redeemedByEndUser: redeemedByEndUserValue,
          currency: 'THB_TOKEN',
        },
      });
    }

    // Sort by total value descending
    result.sort((a, b) => b.couponValue.total - a.couponValue.total);

    return result;
  }
}
