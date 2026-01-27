import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { DashboardQueryDto } from '../dtos/dashboard-query.dto';
import {
  MerchantRefDashboardResponse,
  MerchantRefCouponSummary,
  MerchantRefEndUserSummary,
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
    // Parse date range for mock response
    const dateRange = this.parseDateRange(query);

    // Return mock data with all fields as 0
    return {
      dateRange,
      merchantRef,
      myMerchantSummary: {
        coupon: {
          total: 0,
          pendingUse: 0,
          redeemed: 0,
        },
        endUser: {
          total: 0,
          pendingUsers: 0,
          redeemedUsers: 0,
        },
      },
    };

    // === Commented out: Original implementation ===
    // try {
    //   this.logger.log(
    //     `[START] Getting merchantRef dashboard for ref: ${merchantRef}`,
    //   );

    //   // Parse date range
    //   const dateRange = this.parseDateRange(query);

    //   // Get voucher codes data
    //   const { couponSummary, endUserSummary } = await this.getMerchantSummary(
    //     merchantRef,
    //     dateRange,
    //   );

    //   this.logger.log(
    //     `[SUCCESS] MerchantRef dashboard retrieved for ref: ${merchantRef}`,
    //   );

    //   return {
    //     dateRange,
    //     merchantRef,
    //     myMerchantSummary: {
    //       coupon: couponSummary,
    //       endUser: endUserSummary,
    //     },
    //   };
    // } catch (error) {
    //   this.logger.error(
    //     `[ERROR] Failed to get merchantRef dashboard: ${error.message}`,
    //     error.stack,
    //   );

    //   throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    // }
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
   * Get merchant summary including coupon and end user statistics
   */
  private async getMerchantSummary(
    merchantRef: string,
    dateRange: DateRangeInfo,
  ): Promise<{
    couponSummary: MerchantRefCouponSummary;
    endUserSummary: MerchantRefEndUserSummary;
  }> {
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
        couponSummary: {
          total: 0,
          pendingUse: 0,
          redeemed: 0,
        },
        endUserSummary: {
          total: 0,
          pendingUsers: 0,
          redeemedUsers: 0,
        },
      };
    }

    // Get all voucher codes for these vouchers (sold to end users)
    const voucherCodes = await this.prisma.voucherCode.findMany({
      where: {
        voucherId: { in: voucherIds },
        currentOwnerId: { not: null }, // Purchased by end user
        createdAt: { gte: startDate, lte: endDate },
      },
      select: {
        currentOwnerId: true,
        isUsed: true,
      },
    });

    // Coupon summary
    const soldToEndUser = voucherCodes.length;
    const pendingUse = voucherCodes.filter((c) => !c.isUsed).length;
    const redeemed = voucherCodes.filter((c) => c.isUsed).length;

    // End user summary
    const allPurchasers = new Set(voucherCodes.map((c) => c.currentOwnerId));
    const usedCodes = voucherCodes.filter((c) => c.isUsed);
    const unusedCodes = voucherCodes.filter((c) => !c.isUsed);

    const usersWithUnusedCodes = new Set(
      unusedCodes.map((c) => c.currentOwnerId),
    );
    const usersWithUsedCodes = new Set(usedCodes.map((c) => c.currentOwnerId));

    return {
      couponSummary: {
        total: soldToEndUser,
        pendingUse,
        redeemed,
      },
      endUserSummary: {
        total: allPurchasers.size,
        pendingUsers: usersWithUnusedCodes.size,
        redeemedUsers: usersWithUsedCodes.size,
      },
    };
  }
}
