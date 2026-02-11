import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';
import { TransactionTypeId } from 'src/constants/transaction-types.enum';
import { DashboardQueryDto } from '../dtos/dashboard-query.dto';
import {
  MarketerDashboardResponse,
  DateRangeInfo,
  CouponDropdownResponse,
} from '../types/dashboard.types';
import { startOfMonth, endOfDay, startOfDay, format } from 'date-fns';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';
import { convertBufferToAddress } from 'src/libs/convertBufferToAddress';
import { Prisma } from '@prisma/client';

@Injectable()
export class GetMarketerDashboardHandler {
  private logger = new Logger(GetMarketerDashboardHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly blockchainService: BlockchainService,
  ) {}

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

      // Parse date range (kept for response only, not used in queries - All Time)
      const dateRange = this.parseDateRange(query);

      // Execute all queries in parallel (All Time - no date filtering)
      const [couponAndEndUserStats, transactionAndThbStats, pointsData] =
        await Promise.all([
          this.getCouponAndEndUserStats(merchantId, query.couponIds),
          this.getTransactionAndThbStats(merchantId),
          this.getPointsData(merchantId),
        ]);

      this.logger.log(
        `[SUCCESS] Marketer dashboard retrieved for merchant: ${merchantId}`,
      );

      return {
        dateRange,
        couponCount: couponAndEndUserStats.couponCount,
        couponValue: couponAndEndUserStats.couponValue,
        couponValueByCurrency: couponAndEndUserStats.couponValueByCurrency,
        endUsers: couponAndEndUserStats.endUsers,
        transactions: transactionAndThbStats.transactions,
        points: pointsData,
        thbToken: transactionAndThbStats.thbToken,
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

    return {
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd'),
    };
  }

  /**
   * Get coupon and end user statistics in a single CTE-based query (All Time)
   * Replaces getVoucherStats + getEndUserStats (7 DB calls → 1)
   * @param couponIds - Optional filter by specific voucher IDs (coupon IDs)
   */
  private async getCouponAndEndUserStats(
    merchantId: string,
    couponIds?: string[],
  ): Promise<{
    couponCount: MarketerDashboardResponse['couponCount'];
    couponValue: MarketerDashboardResponse['couponValue'];
    couponValueByCurrency: MarketerDashboardResponse['couponValueByCurrency'];
    endUsers: MarketerDashboardResponse['endUsers'];
  }> {
    // Single CTE-based query to get all voucher codes with relationships + THB_BUY amounts
    const allCodes = await this.prisma.$queryRaw<
      Array<{
        id: string;
        pointsCost: number | null;
        pointId: string | null;
        currency: string | null;
        currentOwnerId: string | null;
        currentOwnerType: string | null;
        isUsed: boolean;
        listingBatchId: string | null;
        voucherId: string;
        voucherMerchantId: string | null;
        thbPurchasePrice: number | null;
        pointSymbol: string | null;
        batchTotalValue: number | null;
        batchTotalItems: number | null;
        thbBuyAmount: number | null;
      }>
    >`
      WITH thb_buy AS (
        SELECT "voucherCodeId", "amount"
        FROM "Transaction"
        WHERE "merchantId" = ${merchantId}
          AND "transactionTypeId" = ${TransactionTypeId.THB_BUY}
          AND "voucherCodeId" IS NOT NULL
      ),
      owned_voucher_ids AS (
        SELECT "id" FROM "Voucher" WHERE "merchantId" = ${merchantId}
      )
      SELECT
        vc."id",
        vc."pointsCost",
        vc."pointId",
        vc."currency",
        vc."currentOwnerId",
        vc."currentOwnerType"::text as "currentOwnerType",
        vc."isUsed",
        vc."listingBatchId",
        vc."voucherId",
        v."merchantId" as "voucherMerchantId",
        v."thbPurchasePrice",
        p."symbol" as "pointSymbol",
        lb."totalValue" as "batchTotalValue",
        lb."totalItems" as "batchTotalItems",
        tb."amount" as "thbBuyAmount"
      FROM "VoucherCode" vc
      JOIN "Voucher" v ON vc."voucherId" = v."id"
      LEFT JOIN "Point" p ON vc."pointId" = p."id"
      LEFT JOIN "ListingBatch" lb ON vc."listingBatchId" = lb."id"
      LEFT JOIN thb_buy tb ON vc."id" = tb."voucherCodeId"
      WHERE (
        vc."voucherId" IN (SELECT "id" FROM owned_voucher_ids)
        OR (vc."currentOwnerId" = ${merchantId} AND vc."currentOwnerType" = 'MERCHANT'::"ParticipantType")
        OR vc."id" IN (SELECT "voucherCodeId" FROM thb_buy)
      )
    `;

    // Deduplicate codes by id
    const uniqueCodesMap = new Map<string, (typeof allCodes)[0]>();
    for (const row of allCodes) {
      uniqueCodesMap.set(row.id, row);
    }
    const uniqueCodes = Array.from(uniqueCodesMap.values());

    this.logger.debug(
      `[getCouponAndEndUserStats] Found ${uniqueCodes.length} unique voucher codes`,
    );

    // --- End User Stats (from all codes, no couponIds filter) ---
    const customerCodes = uniqueCodes.filter(
      (c) => c.currentOwnerType === 'CUSTOMER',
    );
    const uniqueCustomerIds = new Set(
      customerCodes.map((c) => c.currentOwnerId),
    );
    const pendingCustomerIds = new Set(
      customerCodes.filter((c) => !c.isUsed).map((c) => c.currentOwnerId),
    );
    const redeemedCustomerIds = new Set(
      customerCodes.filter((c) => c.isUsed).map((c) => c.currentOwnerId),
    );
    const endUsers = {
      total: uniqueCustomerIds.size,
      unredeemedUsers: pendingCustomerIds.size,
      redeemedUsers: redeemedCustomerIds.size,
    };

    // --- Voucher Stats (apply couponIds filter if provided) ---
    const filteredCodes =
      couponIds && couponIds.length > 0
        ? uniqueCodes.filter((c) => couponIds.includes(c.voucherId))
        : uniqueCodes;

    if (filteredCodes.length === 0) {
      return {
        couponCount: {
          total: 0,
          unsold: 0,
          sold: 0,
          unredeemed: 0,
          redeemed: 0,
        },
        couponValue: {
          total: 0,
          unsold: 0,
          sold: 0,
          unredeemed: 0,
          redeemed: 0,
        },
        couponValueByCurrency: [],
        endUsers,
      };
    }

    // Identify purchased codes from THB_BUY (thbBuyAmount != null from JOIN)
    const purchasedCodeIds = new Set<string>();
    const codeIdToPurchaseAmount = new Map<string, number>();
    for (const code of uniqueCodes) {
      if (code.thbBuyAmount !== null) {
        purchasedCodeIds.add(code.id);
        codeIdToPurchaseAmount.set(code.id, code.thbBuyAmount || 0);
      }
    }

    // Filter purchased codes (has THB_BUY tx OR merchant-owns from seller voucher OR has listingBatchId)
    const purchasedCodes = filteredCodes.filter((c) => {
      if (purchasedCodeIds.has(c.id)) return true;
      if (
        c.currentOwnerType === 'MERCHANT' &&
        c.currentOwnerId === merchantId
      ) {
        if (c.voucherMerchantId !== merchantId) return true;
      }
      if (c.listingBatchId) return true;
      return false;
    });

    // Get purchase price: THB_BUY tx amount > listingBatch > thbPurchasePrice
    const getPurchasePrice = (c: (typeof uniqueCodes)[0]) => {
      const txAmount = codeIdToPurchaseAmount.get(c.id);
      if (txAmount !== undefined) return txAmount;
      if (c.batchTotalItems && c.batchTotalItems > 0) {
        return (c.batchTotalValue || 0) / c.batchTotalItems;
      }
      return c.thbPurchasePrice ?? 0;
    };

    // Calculate coupon counts and THB values from purchased codes only
    let totalCount = 0,
      unsoldCount = 0,
      soldCount = 0,
      unredeemedCount = 0,
      redeemedCount = 0;
    let totalThbValue = 0,
      unsoldThbValue = 0,
      soldThbValue = 0,
      unredeemedThbValue = 0,
      redeemedThbValue = 0;

    for (const code of purchasedCodes) {
      const value = getPurchasePrice(code);
      totalThbValue += value;
      totalCount += 1;

      const isMerchantActivated = code.pointId !== null;
      if (isMerchantActivated) {
        soldThbValue += value;
        soldCount += 1;
        if (code.isUsed) {
          redeemedThbValue += value;
          redeemedCount += 1;
        } else if (code.currentOwnerType === 'CUSTOMER') {
          unredeemedThbValue += value;
          unredeemedCount += 1;
        }
      } else {
        unsoldThbValue += value;
        unsoldCount += 1;
      }
    }

    // Calculate couponValueByCurrency from activated codes (pointId != null)
    const pointStatsMap = new Map<
      string,
      {
        currency: string;
        total: number;
        unsold: number;
        sold: number;
        unredeemed: number;
        redeemed: number;
      }
    >();

    for (const code of filteredCodes) {
      if (!code.pointId) continue;
      const pointId = code.pointId;
      const currency = code.pointSymbol || code.currency || 'UNKNOWN';

      if (!pointStatsMap.has(pointId)) {
        pointStatsMap.set(pointId, {
          currency,
          total: 0,
          unsold: 0,
          sold: 0,
          unredeemed: 0,
          redeemed: 0,
        });
      }

      const stats = pointStatsMap.get(pointId)!;
      const value = code.pointsCost ?? 0;
      stats.total += value;
      stats.sold += value;
      if (code.isUsed) {
        stats.redeemed += value;
      } else if (code.currentOwnerType === 'CUSTOMER') {
        stats.unredeemed += value;
      }
    }

    const couponValueByCurrency = Array.from(pointStatsMap.entries())
      .filter(([, stats]) => stats.currency !== 'THB')
      .map(([, stats]) => ({
        currency: stats.currency,
        total: stats.total,
        unsold: stats.unsold,
        sold: stats.sold,
        unredeemed: stats.unredeemed,
        redeemed: stats.redeemed,
      }));

    return {
      couponCount: {
        total: totalCount,
        unsold: unsoldCount,
        sold: soldCount,
        unredeemed: unredeemedCount,
        redeemed: redeemedCount,
      },
      couponValue: {
        total: totalThbValue,
        unsold: unsoldThbValue,
        sold: soldThbValue,
        unredeemed: unredeemedThbValue,
        redeemed: redeemedThbValue,
      },
      couponValueByCurrency,
      endUsers,
    };
  }

  /**
   * Get transaction + THB stats in a single aggregate query (All Time)
   * Replaces getTransactionStats + getThbStats (4 DB calls → 1)
   */
  private async getTransactionAndThbStats(merchantId: string): Promise<{
    transactions: MarketerDashboardResponse['transactions'];
    thbToken: MarketerDashboardResponse['thbToken'];
  }> {
    try {
      const [result] = await this.prisma.$queryRaw<
        Array<{
          transferPoint: number;
          purchaseCoupon: number;
          deposited: number;
          bought: number;
        }>
      >`
        SELECT
          COALESCE(SUM(CASE WHEN "transactionTypeId" = ${TransactionTypeId.TRANSFER} AND "type" = 'POINT'::"AssetType" THEN "amount" ELSE 0 END), 0)::float as "transferPoint",
          COALESCE(SUM(CASE WHEN "transactionTypeId" = ${TransactionTypeId.REDEEM} THEN "amount" ELSE 0 END), 0)::float as "purchaseCoupon",
          COALESCE(SUM(CASE WHEN "transactionTypeId" = ${TransactionTypeId.THB_MINT} AND "type" = 'THB_TOKEN'::"AssetType" THEN "amount" ELSE 0 END), 0)::float as "deposited",
          COALESCE(SUM(CASE WHEN "transactionTypeId" = ${TransactionTypeId.THB_BUY} AND "type" = 'THB_TOKEN'::"AssetType" THEN "amount" ELSE 0 END), 0)::float as "bought"
        FROM "Transaction"
        WHERE "merchantId" = ${merchantId}
          AND "transactionTypeId" IN (${Prisma.join([TransactionTypeId.TRANSFER, TransactionTypeId.REDEEM, TransactionTypeId.THB_MINT, TransactionTypeId.THB_BUY])})
      `;

      const deposited = Number(result?.deposited ?? 0);
      const bought = Number(result?.bought ?? 0);

      return {
        transactions: {
          transferPoint: Number(result?.transferPoint ?? 0),
          purchaseCoupon: Number(result?.purchaseCoupon ?? 0),
        },
        thbToken: {
          deposited,
          balance: deposited - bought,
          bought,
        },
      };
    } catch {
      this.logger.warn('[getTransactionAndThbStats] Error, returning defaults');
      return {
        transactions: { transferPoint: 0, purchaseCoupon: 0 },
        thbToken: { deposited: 0, balance: 0, bought: 0 },
      };
    }
  }

  /**
   * Get points data for the merchant
   * Returns an array of points with their individual supply, type info, and remaining balance
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
        contractAddress: true,
      },
    });

    // Get merchant wallet address for balance lookup
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
      include: { wallet: true },
    });
    const merchantWalletAddress = merchant?.wallet?.walletAddress;

    // Fetch balance for each point from blockchain
    const pointsWithBalance = await Promise.all(
      points.map(async (p) => {
        let balance = 0;

        if (merchantWalletAddress) {
          try {
            const contractAddress = convertBufferToAddress(p.contractAddress);
            const balanceStr = await this.blockchainService.getBalance({
              walletAddress: merchantWalletAddress,
              pointAddress: contractAddress,
            });
            balance = balanceStr ? Number(balanceStr) : 0;
          } catch (error) {
            this.logger.warn(
              `Failed to get balance for point ${p.id}: ${error.message}`,
            );
          }
        }

        return {
          symbol: p.symbol,
          total: p.initialSupply,
          balance,
        };
      }),
    );

    return pointsWithBalance;
  }

  /**
   * Get coupon dropdown list for marketer
   * Returns vouchers that marketer owns or purchased from seller
   */
  async getCouponDropdown(merchantId: string): Promise<CouponDropdownResponse> {
    this.logger.log(
      `[START] Getting coupon dropdown for marketer: ${merchantId}`,
    );

    // Get THB_BUY transactions to find purchased vouchers
    const thbBuyTransactions = await this.prisma.transaction.findMany({
      where: {
        merchantId,
        transactionTypeId: TransactionTypeId.THB_BUY,
        voucherCodeId: { not: null },
      },
      select: {
        voucherCode: {
          select: { voucherId: true },
        },
      },
    });

    const purchasedVoucherIds = [
      ...new Set(
        thbBuyTransactions
          .map((tx) => tx.voucherCode?.voucherId)
          .filter((id): id is string => !!id),
      ),
    ];

    // Get owned vouchers + purchased vouchers
    const vouchers = await this.prisma.voucher.findMany({
      where: {
        OR: [
          { merchantId },
          ...(purchasedVoucherIds.length > 0
            ? [{ id: { in: purchasedVoucherIds } }]
            : []),
        ],
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    this.logger.log(
      `[SUCCESS] Found ${vouchers.length} coupons for marketer dropdown`,
    );

    return { coupons: vouchers };
  }
}
