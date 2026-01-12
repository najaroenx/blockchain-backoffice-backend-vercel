import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';
import { TransactionTypeId } from 'src/constants/transaction-types.enum';
import { AssetType } from '@prisma/client';
import { DashboardQueryDto, Granularity } from '../dtos/dashboard-query.dto';
import {
  SellerDashboardResponse,
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

      // Parse date range
      const dateRange = this.parseDateRange(query);

      // Execute all queries in parallel
      const [listingStats, marketerBreakdown, timeSeries] = await Promise.all([
        this.getListingStats(walletAddress, dateRange),
        this.getMarketerBreakdown(walletAddress, dateRange),
        this.getTimeSeries(walletAddress, dateRange),
      ]);

      this.logger.log(
        `[SUCCESS] Seller dashboard retrieved for wallet: ${walletAddress}`,
      );

      return {
        dateRange,
        walletAddress,
        overview: listingStats,
        byMarketer: marketerBreakdown,
        timeSeries,
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
   * Get listing statistics for the seller
   * Seller lists items via ListingBatch
   */
  private async getListingStats(
    walletAddress: string,
    dateRange: DateRangeInfo,
  ): Promise<SellerDashboardResponse['overview']> {
    const startDate = new Date(dateRange.startDate);
    const endDate = new Date(dateRange.endDate);

    // Get all listing batches for this seller
    const listingBatches = await this.prisma.listingBatch.findMany({
      where: {
        sellerWalletAddress: walletAddress,
        createdAt: { gte: startDate, lte: endDate },
      },
      select: {
        id: true,
        totalItems: true,
        soldItems: true,
        totalValue: true,
        status: true,
      },
    });

    if (listingBatches.length === 0) {
      return {
        coupons: { listed: 0, soldToMarketer: 0, available: 0 },
        value: { listed: 0, soldToMarketer: 0, available: 0, currency: 'THB' },
      };
    }

    const listed = listingBatches.reduce((sum, b) => sum + b.totalItems, 0);
    const totalValue = listingBatches.reduce((sum, b) => sum + b.totalValue, 0);
    const soldToMarketer = listingBatches.reduce(
      (sum, b) => sum + (b.soldItems || 0),
      0,
    );

    // Calculate sold value proportionally
    const soldValue = listed > 0 ? (totalValue / listed) * soldToMarketer : 0;
    const available = listed - soldToMarketer;
    const availableValue = totalValue - soldValue;

    return {
      coupons: { listed, soldToMarketer, available },
      value: {
        listed: totalValue,
        soldToMarketer: soldValue,
        available: availableValue,
        currency: 'THB',
      },
    };
  }

  /**
   * Get breakdown by marketer (merchant who bought from seller)
   */
  private async getMarketerBreakdown(
    walletAddress: string,
    dateRange: DateRangeInfo,
  ): Promise<SellerDashboardResponse['byMarketer']> {
    const startDate = new Date(dateRange.startDate);
    const endDate = new Date(dateRange.endDate);

    // Get all THB_BUY transactions for this seller, grouped by merchant
    const transactions = await this.prisma.transaction.findMany({
      where: {
        receiverId: walletAddress,
        transactionTypeId: TransactionTypeId.THB_BUY,
        type: AssetType.THB_TOKEN,
        createdAt: { gte: startDate, lte: endDate },
      },
      select: {
        merchantId: true,
        amount: true,
        merchant: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Group by merchant
    const merchantMap = new Map<
      string,
      {
        merchantId: string;
        merchantName: string;
        couponsBought: number;
        valueBought: number;
      }
    >();

    for (const tx of transactions) {
      const key = tx.merchantId;
      if (!key) continue;

      const existing = merchantMap.get(key);
      if (existing) {
        existing.couponsBought += 1;
        existing.valueBought += tx.amount || 0;
      } else {
        merchantMap.set(key, {
          merchantId: key,
          merchantName: tx.merchant?.name || 'Unknown',
          couponsBought: 1,
          valueBought: tx.amount || 0,
        });
      }
    }

    return Array.from(merchantMap.values()).sort(
      (a, b) => b.valueBought - a.valueBought,
    );
  }

  /**
   * Get time series data for listings and sales
   */
  private async getTimeSeries(
    walletAddress: string,
    dateRange: DateRangeInfo,
  ): Promise<SellerDashboardResponse['timeSeries']> {
    const periods = this.generateTimePeriods(dateRange);

    return Promise.all(
      periods.map(async (period) => {
        // Count listings created in this period
        const listingsAgg = await this.prisma.listingBatch.aggregate({
          where: {
            sellerWalletAddress: walletAddress,
            createdAt: { gte: period.start, lte: period.end },
          },
          _sum: { totalItems: true },
        });

        // Count sales in this period
        const salesAgg = await this.prisma.transaction.aggregate({
          where: {
            receiverId: walletAddress,
            transactionTypeId: TransactionTypeId.THB_BUY,
            type: AssetType.THB_TOKEN,
            createdAt: { gte: period.start, lte: period.end },
          },
          _count: { id: true },
        });

        return {
          period: period.period,
          label: period.label,
          listed: listingsAgg._sum.totalItems || 0,
          sold: salesAgg._count.id || 0,
        };
      }),
    );
  }
}
