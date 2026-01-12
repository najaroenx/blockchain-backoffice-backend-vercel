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
  MerchantRefDashboardResponse,
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
export class GetMerchantRefDashboardHandler {
  private logger = new Logger(GetMerchantRefDashboardHandler.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(
    merchantRef: string,
    query: DashboardQueryDto,
  ): Promise<MerchantRefDashboardResponse> {
    try {
      this.logger.log(
        `[START] Getting merchantRef dashboard for ref: ${merchantRef}`,
      );

      // Parse date range
      const dateRange = this.parseDateRange(query);

      // Execute all queries in parallel
      const [overview, endUserStats, timeSeries] = await Promise.all([
        this.getOverview(merchantRef, dateRange),
        this.getEndUserStats(merchantRef, dateRange),
        this.getTimeSeries(merchantRef, dateRange),
      ]);

      this.logger.log(
        `[SUCCESS] MerchantRef dashboard retrieved for ref: ${merchantRef}`,
      );

      return {
        dateRange,
        merchantRef,
        overview,
        endUsers: endUserStats,
        timeSeries,
      };
    } catch (error) {
      this.logger.error(
        `[ERROR] Failed to get merchantRef dashboard: ${error.message}`,
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
   * Get overview statistics for the merchantRef
   * MerchantRef sees: vouchers purchased by end users and redeemed
   */
  private async getOverview(
    merchantRef: string,
    dateRange: DateRangeInfo,
  ): Promise<MerchantRefDashboardResponse['overview']> {
    const startDate = new Date(dateRange.startDate);
    const endDate = new Date(dateRange.endDate);

    // Get all vouchers with this merchantRef
    const vouchers = await this.prisma.voucher.findMany({
      where: { merchantRef },
      select: { id: true },
    });

    const voucherIds = vouchers.map((v) => v.id);

    if (voucherIds.length === 0) {
      return {
        coupons: { purchasedNotUsed: 0, redeemed: 0 },
      };
    }

    // Get all voucher codes for these vouchers
    const voucherCodes = await this.prisma.voucherCode.findMany({
      where: {
        voucherId: { in: voucherIds },
        currentOwnerId: { not: null }, // Purchased by end user
        createdAt: { gte: startDate, lte: endDate },
      },
      select: {
        id: true,
        isUsed: true,
      },
    });

    const purchasedNotUsed = voucherCodes.filter((c) => !c.isUsed).length;
    const redeemed = voucherCodes.filter((c) => c.isUsed).length;

    return {
      coupons: { purchasedNotUsed, redeemed },
    };
  }

  /**
   * Get end user statistics for the merchantRef
   * End users who purchased vouchers with this merchantRef
   */
  private async getEndUserStats(
    merchantRef: string,
    dateRange: DateRangeInfo,
  ): Promise<MerchantRefDashboardResponse['endUsers']> {
    const startDate = new Date(dateRange.startDate);
    const endDate = new Date(dateRange.endDate);

    // Get all vouchers with this merchantRef
    const vouchers = await this.prisma.voucher.findMany({
      where: { merchantRef },
      select: { id: true },
    });

    const voucherIds = vouchers.map((v) => v.id);

    if (voucherIds.length === 0) {
      return {
        total: 0,
        purchased: 0,
        couponsSold: 0,
        couponsNotUsed: 0,
        couponsRedeemed: 0,
      };
    }

    // Get all voucher codes for these vouchers
    const voucherCodes = await this.prisma.voucherCode.findMany({
      where: {
        voucherId: { in: voucherIds },
        currentOwnerId: { not: null },
        createdAt: { gte: startDate, lte: endDate },
      },
      select: {
        currentOwnerId: true,
        isUsed: true,
      },
    });

    // Unique purchasers
    const allPurchasers = new Set(voucherCodes.map((c) => c.currentOwnerId));
    const total = allPurchasers.size;
    const purchased = allPurchasers.size;
    const couponsSold = voucherCodes.length;
    const couponsNotUsed = voucherCodes.filter((c) => !c.isUsed).length;
    const couponsRedeemed = voucherCodes.filter((c) => c.isUsed).length;

    return {
      total,
      purchased,
      couponsSold,
      couponsNotUsed,
      couponsRedeemed,
    };
  }

  /**
   * Get time series data for sales and redemptions
   */
  private async getTimeSeries(
    merchantRef: string,
    dateRange: DateRangeInfo,
  ): Promise<MerchantRefDashboardResponse['timeSeries']> {
    // Get all vouchers with this merchantRef
    const vouchers = await this.prisma.voucher.findMany({
      where: { merchantRef },
      select: { id: true, merchantId: true },
    });

    const voucherIds = vouchers.map((v) => v.id);
    const merchantId = vouchers[0]?.merchantId;

    if (voucherIds.length === 0) {
      return [];
    }

    const periods = this.generateTimePeriods(dateRange);

    return Promise.all(
      periods.map(async (period) => {
        // Count TRANSFER transactions with VOUCHER type
        const salesCount = await this.prisma.transaction.count({
          where: {
            transactionTypeId: TransactionTypeId.TRANSFER,
            type: AssetType.VOUCHER,
            receiverType: 'CUSTOMER',
            createdAt: { gte: period.start, lte: period.end },
            voucherCode: {
              voucherId: { in: voucherIds },
            },
          },
        });

        // Count redeemed voucher codes
        const redeemedCount = await this.prisma.voucherCode.count({
          where: {
            voucherId: { in: voucherIds },
            isUsed: true,
            usedAt: { gte: period.start, lte: period.end },
          },
        });

        // Count new users associated with the merchant
        let newUsersCount = 0;
        if (merchantId) {
          newUsersCount = await this.prisma.customerMerChant.count({
            where: {
              merchantId,
              createdAt: { gte: period.start, lte: period.end },
            },
          });
        }

        return {
          period: period.period,
          label: period.label,
          couponsSold: salesCount,
          couponsRedeemed: redeemedCount,
          newUsers: newUsersCount,
        };
      }),
    );
  }
}
