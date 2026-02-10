import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { DashboardQueryDto } from '../dtos/dashboard-query.dto';
import {
  MerchantRefDashboardResponse,
  MerchantRefCouponSummary,
  MerchantRefEndUserSummary,
  DateRangeInfo,
  CouponDropdownResponse,
} from '../types/dashboard.types';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';
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

      // Get voucher codes data
      const { couponSummary, endUserSummary } = await this.getMerchantSummary(
        merchantRef,
        dateRange,
        query.couponIds,
      );

      this.logger.log(
        `[SUCCESS] MerchantRef dashboard retrieved for ref: ${merchantRef}`,
      );

      return {
        dateRange,
        merchantRef,
        myMerchantSummary: {
          coupon: couponSummary,
          endUser: endUserSummary,
        },
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
   * Get merchant summary including coupon and end user statistics
   * Note: dateRange is received but not used for filtering (ALL-TIME data) - TO IMPLEMENT
   * @param couponIds - Optional filter by specific voucher IDs (coupon IDs)
   */
  private async getMerchantSummary(
    merchantRef: string,
    _dateRange: DateRangeInfo, // eslint-disable-line @typescript-eslint/no-unused-vars
    couponIds?: string[],
  ): Promise<{
    couponSummary: MerchantRefCouponSummary;
    endUserSummary: MerchantRefEndUserSummary;
  }> {
    // TODO: Implement date range filtering when needed
    // const startDate = new Date(_dateRange.startDate);
    // const endDate = new Date(_dateRange.endDate);

    // Build couponIds filter if provided
    const couponIdsFilter =
      couponIds && couponIds.length > 0 ? { id: { in: couponIds } } : {};

    // Get all vouchers with this merchantRef
    const vouchers = await this.prisma.voucher.findMany({
      where: { merchantRef, ...couponIdsFilter },
      select: { id: true },
    });

    const voucherIds = vouchers.map((v) => v.id);

    if (voucherIds.length === 0) {
      return {
        couponSummary: {
          total: 0,
          unredeemed: 0,
          redeemed: 0,
        },
        endUserSummary: {
          total: 0,
          unredeemedUsers: 0,
          redeemedUsers: 0,
        },
      };
    }

    // Get all voucher codes for these vouchers (sold to end users) - ALL-TIME
    // TODO: Add date range filtering when implemented
    const voucherCodes = await this.prisma.voucherCode.findMany({
      where: {
        voucherId: { in: voucherIds },
        currentOwnerId: { not: null }, // Purchased by end user
        // createdAt: { gte: startDate, lte: endDate }, // TO IMPLEMENT
      },
      select: {
        currentOwnerId: true,
        isUsed: true,
      },
    });

    // Coupon summary
    const soldToEndUser = voucherCodes.length;
    const unredeemed = voucherCodes.filter((c) => !c.isUsed).length;
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
        unredeemed,
        redeemed,
      },
      endUserSummary: {
        total: allPurchasers.size,
        unredeemedUsers: usersWithUnusedCodes.size,
        redeemedUsers: usersWithUsedCodes.size,
      },
    };
  }

  /**
   * Get coupon dropdown list for merchantRef
   * Returns vouchers that have this merchantRef
   */
  async getCouponDropdown(
    merchantRef: string,
  ): Promise<CouponDropdownResponse> {
    this.logger.log(
      `[START] Getting coupon dropdown for merchantRef: ${merchantRef}`,
    );

    const vouchers = await this.prisma.voucher.findMany({
      where: { merchantRef },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    this.logger.log(
      `[SUCCESS] Found ${vouchers.length} coupons for merchantRef dropdown`,
    );

    return { coupons: vouchers };
  }
}
