import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';
import { TransactionTypeId } from 'src/constants/transaction-types.enum';
import { DashboardQueryDto, Granularity } from '../dtos/dashboard-query.dto';
import {
  MarketerDashboardResponse,
  DateRangeInfo,
} from '../types/dashboard.types';
import {
  startOfMonth,
  endOfDay,
  startOfDay,
  format,
  eachMonthOfInterval,
  eachWeekOfInterval,
  eachDayOfInterval,
} from 'date-fns';

@Injectable()
export class GetMarketerDashboardHandler {
  private logger = new Logger(GetMarketerDashboardHandler.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(
    merchantId: string,
    query: DashboardQueryDto,
  ): Promise<MarketerDashboardResponse> {
    try {
      this.logger.log(
        `[START] Getting marketer dashboard for merchant: ${merchantId}`,
      );

      // Validate merchant exists
      const merchant = await this.prisma.merchant.findUnique({
        where: { id: merchantId },
        select: { id: true, name: true },
      });

      if (!merchant) {
        throw new NotFoundException(`Merchant ${merchantId} not found`);
      }

      // Parse date range
      const dateRange = this.parseDateRange(query);

      // Execute all queries in parallel
      const [
        voucherStats,
        endUserStats,
        transactionStats,
        pointsData,
        thbStats,
      ] = await Promise.all([
        this.getVoucherStats(merchantId, dateRange),
        this.getEndUserStats(merchantId, dateRange),
        this.getTransactionStats(merchantId, dateRange),
        this.getPointsData(merchantId),
        this.getThbStats(merchantId, dateRange),
      ]);

      this.logger.log(
        `[SUCCESS] Marketer dashboard retrieved for merchant: ${merchantId}`,
      );

      return {
        dateRange,
        vouchers: voucherStats.vouchers,
        voucherValue: voucherStats.voucherValue,
        endUsers: endUserStats,
        transactions: transactionStats,
        points: pointsData,
        thbToken: thbStats,
      };
    } catch (error) {
      this.logger.error(
        `[ERROR] Failed to get marketer dashboard: ${error.message}`,
        error.stack,
      );

      if (error instanceof NotFoundException) {
        throw error;
      }
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
    const granularity = query.granularity || Granularity.MONTHLY;

    return {
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd'),
      granularity,
    };
  }

  private generateTimePeriods(
    dateRange: DateRangeInfo,
  ): { period: string; label: string; start: Date; end: Date }[] {
    const startDate = new Date(dateRange.startDate);
    const endDate = new Date(dateRange.endDate);
    const periods: { period: string; label: string; start: Date; end: Date }[] =
      [];

    if (dateRange.granularity === Granularity.DAILY) {
      const days = eachDayOfInterval({ start: startDate, end: endDate });
      for (const day of days) {
        periods.push({
          period: format(day, 'yyyy-MM-dd'),
          label: format(day, 'MMM d'),
          start: startOfDay(day),
          end: endOfDay(day),
        });
      }
    } else if (dateRange.granularity === Granularity.WEEKLY) {
      const weeks = eachWeekOfInterval({ start: startDate, end: endDate });
      for (let i = 0; i < weeks.length; i++) {
        const weekStart = weeks[i];
        const weekEnd = i < weeks.length - 1 ? weeks[i + 1] : endDate;
        periods.push({
          period: format(weekStart, "yyyy-'W'ww"),
          label: `Week ${format(weekStart, 'w')}`,
          start: weekStart,
          end: weekEnd,
        });
      }
    } else {
      const months = eachMonthOfInterval({ start: startDate, end: endDate });
      for (const month of months) {
        const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);
        periods.push({
          period: format(month, 'yyyy-MM'),
          label: format(month, 'MMMM'),
          start: startOfDay(month),
          end: endOfDay(monthEnd),
        });
      }
    }

    return periods;
  }

  /**
   * Get voucher statistics for the merchant
   */
  private async getVoucherStats(
    merchantId: string,
    dateRange: DateRangeInfo,
  ): Promise<{
    vouchers: MarketerDashboardResponse['vouchers'];
    voucherValue: MarketerDashboardResponse['voucherValue'];
  }> {
    const startDate = new Date(dateRange.startDate);
    const endDate = new Date(dateRange.endDate);

    // Get all vouchers for this merchant
    const vouchers = await this.prisma.voucher.findMany({
      where: { merchantId },
      select: { id: true, value: true },
    });

    const voucherIds = vouchers.map((v) => v.id);

    if (voucherIds.length === 0) {
      return {
        vouchers: { total: 0, sold: 0, pending: 0, redeemed: 0 },
        voucherValue: { total: 0, sold: 0, redeemed: 0, currency: 'THB' },
      };
    }

    // Get all voucher codes for these vouchers within date range
    const allCodes = await this.prisma.voucherCode.findMany({
      where: {
        voucherId: { in: voucherIds },
        createdAt: { gte: startDate, lte: endDate },
      },
      select: {
        id: true,
        pointsCost: true,
        currentOwnerId: true,
        isUsed: true,
        voucher: { select: { value: true } },
      },
    });

    // Calculate statistics
    const total = allCodes.length;
    const soldCodes = allCodes.filter((c) => c.currentOwnerId !== null);
    const sold = soldCodes.length;
    const pendingCodes = soldCodes.filter((c) => !c.isUsed);
    const pending = pendingCodes.length;
    const redeemedCodes = allCodes.filter((c) => c.isUsed);
    const redeemed = redeemedCodes.length;

    // Calculate values using voucher.value (THB)
    const totalValue = allCodes.reduce(
      (sum, c) => sum + (c.voucher?.value || 0),
      0,
    );
    const soldValue = soldCodes.reduce(
      (sum, c) => sum + (c.voucher?.value || 0),
      0,
    );
    const redeemedValue = redeemedCodes.reduce(
      (sum, c) => sum + (c.voucher?.value || 0),
      0,
    );

    return {
      vouchers: { total, sold, pending, redeemed },
      voucherValue: {
        total: totalValue,
        sold: soldValue,
        redeemed: redeemedValue,
        currency: 'THB',
      },
    };
  }

  /**
   * Get end user statistics for the merchant
   */
  private async getEndUserStats(
    merchantId: string,
    dateRange: DateRangeInfo,
  ): Promise<MarketerDashboardResponse['endUsers']> {
    // Total end users associated with merchant
    const total = await this.prisma.customerMerChant.count({
      where: { merchantId },
    });

    // Get all vouchers for this merchant
    const vouchers = await this.prisma.voucher.findMany({
      where: { merchantId },
      select: { id: true },
    });

    const voucherIds = vouchers.map((v) => v.id);

    if (voucherIds.length === 0) {
      return {
        total,
        purchased: 0,
        couponsPurchased: 0,
        pending: 0,
        redeemed: 0,
        growth: [],
      };
    }

    // Get voucher codes data
    const voucherCodes = await this.prisma.voucherCode.findMany({
      where: {
        voucherId: { in: voucherIds },
        currentOwnerId: { not: null },
      },
      select: { currentOwnerId: true, isUsed: true },
    });

    const uniquePurchasedCustomers = new Set(
      voucherCodes.map((c) => c.currentOwnerId),
    );
    const purchased = uniquePurchasedCustomers.size;
    const couponsPurchased = voucherCodes.length;
    const pending = voucherCodes.filter((c) => !c.isUsed).length;
    const redeemed = voucherCodes.filter((c) => c.isUsed).length;

    // Generate growth time series
    const periods = this.generateTimePeriods(dateRange);
    const growth = await Promise.all(
      periods.map(async (period) => {
        const newUsersCount = await this.prisma.customerMerChant.count({
          where: {
            merchantId,
            createdAt: { gte: period.start, lte: period.end },
          },
        });

        // Active users = users who made transactions in this period
        const activeTransactions = await this.prisma.transaction.findMany({
          where: {
            merchantId,
            createdAt: { gte: period.start, lte: period.end },
            senderType: 'CUSTOMER',
          },
          select: { senderId: true },
          distinct: ['senderId'],
        });

        return {
          period: period.period,
          label: period.label,
          newUsers: newUsersCount,
          activeUsers: activeTransactions.length,
        };
      }),
    );

    return {
      total,
      purchased,
      couponsPurchased,
      pending,
      redeemed,
      growth,
    };
  }

  /**
   * Get transaction statistics (Pie chart: Buy Point vs Redeem Point)
   */
  private async getTransactionStats(
    merchantId: string,
    dateRange: DateRangeInfo,
  ): Promise<MarketerDashboardResponse['transactions']> {
    const startDate = new Date(dateRange.startDate);
    const endDate = new Date(dateRange.endDate);

    // Buy Point transactions (TRANSFER type with POINT asset)
    const buyPointStats = await this.prisma.transaction.aggregate({
      where: {
        merchantId,
        transactionTypeId: TransactionTypeId.TRANSFER,
        type: 'POINT' as any,
        createdAt: { gte: startDate, lte: endDate },
      },
      _count: { id: true },
      _sum: { amount: true },
    });

    // Redeem Point transactions
    const redeemStats = await this.prisma.transaction.aggregate({
      where: {
        merchantId,
        transactionTypeId: TransactionTypeId.REDEEM,
        createdAt: { gte: startDate, lte: endDate },
      },
      _count: { id: true },
      _sum: { amount: true },
    });

    const buyCount = buyPointStats._count.id || 0;
    const redeemCount = redeemStats._count.id || 0;
    const total = buyCount + redeemCount;

    const buyPercentage = total > 0 ? Math.round((buyCount / total) * 100) : 0;
    const redeemPercentage = total > 0 ? 100 - buyPercentage : 0;

    return {
      total,
      buyPoint: { count: buyCount, percentage: buyPercentage },
      redeemPoint: { count: redeemCount, percentage: redeemPercentage },
    };
  }

  /**
   * Get points data for the merchant (Donut chart)
   */
  private async getPointsData(
    merchantId: string,
  ): Promise<MarketerDashboardResponse['points']> {
    const points = await this.prisma.point.findMany({
      where: { merchantId },
      select: {
        id: true,
        name: true,
        symbol: true,
        initialSupply: true,
      },
    });

    const byType = points.map((p) => ({
      type: p.name,
      value: p.initialSupply,
    }));

    const totalCirculation = points.reduce(
      (sum, p) => sum + p.initialSupply,
      0,
    );

    return { totalCirculation, byType };
  }

  /**
   * Get THB token statistics for the merchant (Bar chart)
   */
  private async getThbStats(
    merchantId: string,
    dateRange: DateRangeInfo,
  ): Promise<MarketerDashboardResponse['thbToken']> {
    const startDate = new Date(dateRange.startDate);
    const endDate = new Date(dateRange.endDate);

    try {
      // Sum of THB_MINT transactions (deposited)
      const mintStats = await this.prisma.transaction.aggregate({
        where: {
          merchantId,
          transactionTypeId: TransactionTypeId.THB_MINT,
          type: 'THB_TOKEN' as any,
          createdAt: { gte: startDate, lte: endDate },
        },
        _sum: { amount: true },
      });

      // Sum of THB_BUY transactions (spent)
      const buyStats = await this.prisma.transaction.aggregate({
        where: {
          merchantId,
          transactionTypeId: TransactionTypeId.THB_BUY,
          type: 'THB_TOKEN' as any,
          createdAt: { gte: startDate, lte: endDate },
        },
        _sum: { amount: true },
      });

      // Used for redeem = REDEEM transactions value
      const redeemStats = await this.prisma.transaction.aggregate({
        where: {
          merchantId,
          transactionTypeId: TransactionTypeId.REDEEM,
          createdAt: { gte: startDate, lte: endDate },
        },
        _sum: { amount: true },
      });

      const summary = {
        deposited: mintStats._sum.amount || 0,
        spent: buyStats._sum.amount || 0,
        usedForRedeem: redeemStats._sum.amount || 0,
      };

      // Generate monthly time series
      const periods = this.generateTimePeriods(dateRange);
      const monthly = await Promise.all(
        periods.map(async (period) => {
          const [mintSum, buySum, redeemSum] = await Promise.all([
            this.prisma.transaction.aggregate({
              where: {
                merchantId,
                transactionTypeId: TransactionTypeId.THB_MINT,
                type: 'THB_TOKEN' as any,
                createdAt: { gte: period.start, lte: period.end },
              },
              _sum: { amount: true },
            }),
            this.prisma.transaction.aggregate({
              where: {
                merchantId,
                transactionTypeId: TransactionTypeId.THB_BUY,
                type: 'THB_TOKEN' as any,
                createdAt: { gte: period.start, lte: period.end },
              },
              _sum: { amount: true },
            }),
            this.prisma.transaction.aggregate({
              where: {
                merchantId,
                transactionTypeId: TransactionTypeId.REDEEM,
                createdAt: { gte: period.start, lte: period.end },
              },
              _sum: { amount: true },
            }),
          ]);

          return {
            period: period.period,
            label: period.label,
            deposited: mintSum._sum.amount || 0,
            spent: buySum._sum.amount || 0,
            usedForRedeem: redeemSum._sum.amount || 0,
          };
        }),
      );

      return { summary, monthly };
    } catch {
      this.logger.warn(
        '[THB_STATS] Error getting THB stats, returning defaults',
      );
      return {
        summary: { deposited: 0, spent: 0, usedForRedeem: 0 },
        monthly: [],
      };
    }
  }
}
