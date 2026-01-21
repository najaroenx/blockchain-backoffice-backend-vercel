import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';
import {
  AssetType,
  TransactionTypeId,
} from 'src/constants/transaction-types.enum';
import { DashboardQueryDto } from '../dtos/dashboard-query.dto';
import {
  MarketerDashboardResponse,
  DateRangeInfo,
} from '../types/dashboard.types';
import { startOfMonth, endOfDay, startOfDay, format } from 'date-fns';
import { ParticipantType } from '@prisma/client';

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
        this.getEndUserStats(merchantId),
        this.getTransactionStats(merchantId, dateRange),
        this.getPointsData(merchantId),
        this.getThbStats(merchantId, dateRange),
      ]);

      this.logger.log(
        `[SUCCESS] Marketer dashboard retrieved for merchant: ${merchantId}`,
      );

      return {
        dateRange,
        couponCount: voucherStats.couponCount,
        couponValue: voucherStats.couponValue,
        couponValueByCurrency: voucherStats.couponValueByCurrency,
        endUsers: endUserStats,
        transactions: transactionStats,
        points: pointsData,
        thbToken: thbStats,
      };
      // return {
      //   dateRange,
      //   couponCount: {
      //     purchased: 0,
      //     soldToEndUser: 0,
      //     pendingUse: 0,
      //     redeemed: 0,
      //   },
      //   couponValue: {
      //     total: 0,
      //     sold: 0,
      //     pendingUse: 0,
      //     redeemed: 0,
      //   },
      //   couponValueByCurrency: [],
      //   endUsers: {
      //     buyers: 0,
      //     pendingUsers: 0,
      //     redeemedUsers: 0,
      //   },
      //   transactions: {
      //     transferPoint: 0,
      //     purchaseCoupon: 0,
      //   },
      //   points: [
      //     { total: 10000, types: 'Reward Points' },
      //     { total: 5000, types: 'Bonus Points' },
      //     { total: 2500, types: 'Loyalty Points' },
      //   ],
      //   thbToken: {
      //     deposited: 0,
      //     usedForPromotion: 0,
      //   },
      // };
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

    return {
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd'),
    };
  }

  /**
   * Get voucher statistics for the merchant
   * - couponCount: นับจาก Transaction ตาม date range
   * - couponValue: รวม amount จาก Transaction (THB purchase price per unit)
   */
  private async getVoucherStats(
    merchantId: string,
    dateRange: DateRangeInfo,
  ): Promise<{
    couponCount: MarketerDashboardResponse['couponCount'];
    couponValue: MarketerDashboardResponse['couponValue'];
    couponValueByCurrency: MarketerDashboardResponse['couponValueByCurrency'];
  }> {
    const startDate = new Date(dateRange.startDate);
    const endDate = new Date(dateRange.endDate);

    // Get all vouchers for this merchant (for owned count - all time)
    const vouchers = await this.prisma.voucher.findMany({
      where: { merchantId },
      select: { id: true, value: true, thbPurchasePrice: true },
    });

    const voucherIds = vouchers.map((v) => v.id);

    if (voucherIds.length === 0) {
      return {
        couponCount: {
          purchased: 0,
          soldToEndUser: 0,
          pendingUse: 0,
          redeemed: 0,
        },
        couponValue: {
          total: 0,
          sold: 0,
          pendingUse: 0,
          redeemed: 0,
        },
        couponValueByCurrency: [],
      };
    }

    // Get all voucher codes for these vouchers (for owned count - all time)
    const allCodes = await this.prisma.voucherCode.findMany({
      where: {
        voucherId: { in: voucherIds },
      },
      select: {
        id: true,
        pointsCost: true,
        currency: true,
        currentOwnerId: true,
        isUsed: true,
        voucher: {
          select: { value: true, thbPurchasePrice: true, currency: true },
        },
      },
    });

    const allCodeIds = allCodes.map((c) => c.id);
    const total = allCodes.length;

    // Calculate owned value using voucher.thbPurchasePrice (all time, ไม่ filter date)
    const getThbPrice = (c: (typeof allCodes)[0]) =>
      c.voucher?.thbPurchasePrice ?? 0;
    const ownedValue = allCodes.reduce((sum, c) => sum + getThbPrice(c), 0);

    // Step 2: Create Map for grouping by currency
    // Build a map from voucherCodeId -> currency for later use
    const codeIdToCurrency = new Map<string, string>();
    const currencyStatsMap = new Map<
      string,
      { total: number; sold: number; pendingUse: number; redeemed: number }
    >();

    for (const code of allCodes) {
      // Priority: VoucherCode.currency (Point symbol) > Voucher.currency > 'THB'
      const currency = code.currency || code.voucher?.currency || 'THB';
      codeIdToCurrency.set(code.id, currency);

      // Initialize currency stats if not exists
      if (!currencyStatsMap.has(currency)) {
        currencyStatsMap.set(currency, {
          total: 0,
          sold: 0,
          pendingUse: 0,
          redeemed: 0,
        });
      }

      // Add total value (thbPurchasePrice) for this currency
      const stats = currencyStatsMap.get(currency)!;
      stats.total += getThbPrice(code);
    }

    this.logger.log(
      `[getVoucherStats] Found ${total} voucher codes for merchant, ownedValue=${ownedValue}`,
    );
    this.logger.log(
      `[getVoucherStats] Currency groups: ${Array.from(currencyStatsMap.keys()).join(', ')}`,
    );

    // === Query Transaction data with date range filter ===
    // Run all aggregate queries in parallel for performance

    const [
      // Merchant purchased from seller (THB_BUY transactions)
      purchasedStats,
      // Sold to customer (TRANSFER + VOUCHER, receiverType = CUSTOMER)
      soldStats,
      // Redeemed (REDEEM transactions)
      redeemedStats,
    ] = await Promise.all([
      // 1. Merchant purchased from seller - THB_BUY transactions
      this.prisma.transaction.aggregate({
        where: {
          merchantId,
          transactionTypeId: TransactionTypeId.THB_BUY,
          type: AssetType.THB_TOKEN,
          createdAt: { gte: startDate, lte: endDate },
        },
        _count: { id: true },
        _sum: { amount: true },
      }),

      // 2. Sold to customer - TRANSFER + VOUCHER transactions
      this.prisma.transaction.aggregate({
        where: {
          merchantId,
          transactionTypeId: TransactionTypeId.TRANSFER,
          type: AssetType.VOUCHER,
          receiverType: ParticipantType.CUSTOMER,
          voucherCodeId: { in: allCodeIds.length > 0 ? allCodeIds : undefined },
          createdAt: { gte: startDate, lte: endDate },
        },
        _count: { id: true },
        _sum: { amount: true },
      }),

      // 3. Redeemed - REDEEM transactions
      this.prisma.transaction.aggregate({
        where: {
          merchantId,
          transactionTypeId: TransactionTypeId.REDEEM,
          voucherCodeId: { in: allCodeIds.length > 0 ? allCodeIds : undefined },
          createdAt: { gte: startDate, lte: endDate },
        },
        _count: { id: true },
        _sum: { amount: true },
      }),
    ]);

    // Extract counts from transaction data
    const purchased = purchasedStats._count.id || 0;
    const soldToEndUser = soldStats._count.id || 0;
    const redeemed = redeemedStats._count.id || 0;
    const pendingUse =
      soldToEndUser - redeemed > 0 ? soldToEndUser - redeemed : 0;

    // Extract THB values from transaction data
    const totalValue = ownedValue;
    const soldValue = soldStats._sum.amount || 0;
    const redeemedValue = redeemedStats._sum.amount || 0;
    const pendingValue =
      soldValue - redeemedValue > 0 ? soldValue - redeemedValue : 0;

    this.logger.log(
      `[getVoucherStats] Transaction stats: purchased=${purchased}, soldToEndUser=${soldToEndUser}, pendingUse=${pendingUse}, redeemed=${redeemed}`,
    );
    this.logger.log(
      `[getVoucherStats] THB values: totalValue=${totalValue}, soldValue=${soldValue}, pendingValue=${pendingValue}, redeemedValue=${redeemedValue}`,
    );

    return {
      couponCount: {
        purchased, // From THB_BUY in date range
        soldToEndUser, // From TRANSFER+VOUCHER in date range
        pendingUse, // sold - redeemed in date range
        redeemed, // From REDEEM in date range
      },
      couponValue: {
        total: totalValue, // All time, from voucher.thbPurchasePrice
        sold: soldValue, // From TRANSFER+VOUCHER amount in date range
        pendingUse: pendingValue, // sold - redeemed value
        redeemed: redeemedValue, // From REDEEM amount in date range
      },
      couponValueByCurrency: [], // (Not implemented)
    };
  }

  /**
   * Get end user statistics for the merchant
   */
  private async getEndUserStats(
    merchantId: string,
  ): Promise<MarketerDashboardResponse['endUsers']> {
    // Get all vouchers for this merchant
    const vouchers = await this.prisma.voucher.findMany({
      where: { merchantId },
      select: { id: true },
    });

    const voucherIds = vouchers.map((v) => v.id);

    if (voucherIds.length === 0) {
      return {
        buyers: 0,
        pendingUsers: 0,
        redeemedUsers: 0,
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
    const buyers = uniquePurchasedCustomers.size;

    // Count unique users by status
    const pendingCodes = voucherCodes.filter((c) => !c.isUsed);
    const redeemedCodes = voucherCodes.filter((c) => c.isUsed);
    const pendingUsers = new Set(pendingCodes.map((c) => c.currentOwnerId))
      .size;
    const redeemedUsers = new Set(redeemedCodes.map((c) => c.currentOwnerId))
      .size;

    return {
      buyers,
      pendingUsers,
      redeemedUsers,
    };
  }

  /**
   * Get transaction statistics (Point amounts)
   */
  private async getTransactionStats(
    merchantId: string,
    dateRange: DateRangeInfo,
  ): Promise<MarketerDashboardResponse['transactions']> {
    const startDate = new Date(dateRange.startDate);
    const endDate = new Date(dateRange.endDate);

    // Buy Point transactions (TRANSFER type with POINT asset)
    const transferPointStats = await this.prisma.transaction.aggregate({
      where: {
        merchantId,
        transactionTypeId: TransactionTypeId.TRANSFER,
        type: 'POINT' as any,
        createdAt: { gte: startDate, lte: endDate },
      },
      _sum: { amount: true },
    });

    // Redeem Point transactions
    const redeemStats = await this.prisma.transaction.aggregate({
      where: {
        merchantId,
        transactionTypeId: TransactionTypeId.REDEEM,
        createdAt: { gte: startDate, lte: endDate },
      },
      _sum: { amount: true },
    });

    const transferPoint = transferPointStats._sum.amount || 0;
    const purchaseCoupon = redeemStats._sum.amount || 0;

    return {
      transferPoint,
      purchaseCoupon,
    };
  }

  /**
   * Get points data for the merchant
   * Returns an array of points with their individual supply and type info
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

    // Return array of points with total (initialSupply) and types (name/symbol)
    return points.map((p) => ({
      total: p.initialSupply,
      types: p.name,
    }));
  }

  /**
   * Get THB token statistics for the merchant
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

      // Sum of THB_BUY transactions (used for promotion - buying vouchers from seller)
      const buyStats = await this.prisma.transaction.aggregate({
        where: {
          merchantId,
          transactionTypeId: TransactionTypeId.THB_BUY,
          type: 'THB_TOKEN' as any,
          createdAt: { gte: startDate, lte: endDate },
        },
        _sum: { amount: true },
      });

      return {
        deposited: mintStats._sum.amount || 0,
        usedForPromotion: buyStats._sum.amount || 0,
      };
    } catch {
      this.logger.warn(
        '[THB_STATS] Error getting THB stats, returning defaults',
      );
      return {
        deposited: 0,
        usedForPromotion: 0,
      };
    }
  }
}
