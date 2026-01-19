import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';
import { DashboardQueryDto } from '../dtos/dashboard-query.dto';
import {
  MerchantRefDashboardResponse,
  DateRangeInfo,
} from '../types/dashboard.types';
import { startOfMonth, endOfDay, startOfDay, format } from 'date-fns';

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
      const [overview, endUserStats] = await Promise.all([
        this.getOverview(merchantRef, dateRange),
        this.getEndUserStats(merchantRef, dateRange),
      ]);

      this.logger.log(
        `[SUCCESS] MerchantRef dashboard retrieved for ref: ${merchantRef}`,
      );

      return {
        dateRange,
        merchantRef,
        overview,
        endUsers: endUserStats,
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

    return {
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd'),
    };
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
}
