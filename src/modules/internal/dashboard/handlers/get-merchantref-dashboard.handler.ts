import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { Prisma } from '@prisma/client';
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

      // Single SQL query for coupon + end user stats (was 2 DB calls, now 1)
      const { couponSummary, endUserSummary } = await this.getMerchantSummary(
        merchantRef,
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
   * Get merchant summary using a single raw SQL query
   * Replaces 2 separate Prisma queries (voucher.findMany + voucherCode.findMany)
   * with 1 JOIN + conditional aggregation query
   */
  private async getMerchantSummary(
    merchantRef: string,
    couponIds?: string[],
  ): Promise<{
    couponSummary: MerchantRefCouponSummary;
    endUserSummary: MerchantRefEndUserSummary;
  }> {
    const hasCouponFilter = couponIds && couponIds.length > 0;

    const result = await this.prisma.$queryRaw<
      [
        {
          total: bigint;
          unredeemed: bigint;
          redeemed: bigint;
          totalUsers: bigint;
          unredeemedUsers: bigint;
          redeemedUsers: bigint;
        },
      ]
    >`
      SELECT
        COUNT(*)::bigint AS total,
        COUNT(CASE WHEN NOT vc."isUsed" THEN 1 END)::bigint AS unredeemed,
        COUNT(CASE WHEN vc."isUsed" THEN 1 END)::bigint AS redeemed,
        COUNT(DISTINCT vc."currentOwnerId")::bigint AS "totalUsers",
        COUNT(DISTINCT CASE WHEN NOT vc."isUsed" THEN vc."currentOwnerId" END)::bigint AS "unredeemedUsers",
        COUNT(DISTINCT CASE WHEN vc."isUsed" THEN vc."currentOwnerId" END)::bigint AS "redeemedUsers"
      FROM "VoucherCode" vc
      JOIN "Voucher" v ON vc."voucherId" = v.id
      WHERE v."merchantRef" = ${merchantRef}
        AND vc."currentOwnerId" IS NOT NULL
        ${hasCouponFilter ? Prisma.sql`AND v.id IN (${Prisma.join(couponIds!)})` : Prisma.empty}
    `;

    const row = result[0];

    if (!row || Number(row.total) === 0) {
      return {
        couponSummary: { total: 0, unredeemed: 0, redeemed: 0 },
        endUserSummary: { total: 0, unredeemedUsers: 0, redeemedUsers: 0 },
      };
    }

    return {
      couponSummary: {
        total: Number(row.total),
        unredeemed: Number(row.unredeemed),
        redeemed: Number(row.redeemed),
      },
      endUserSummary: {
        total: Number(row.totalUsers),
        unredeemedUsers: Number(row.unredeemedUsers),
        redeemedUsers: Number(row.redeemedUsers),
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
