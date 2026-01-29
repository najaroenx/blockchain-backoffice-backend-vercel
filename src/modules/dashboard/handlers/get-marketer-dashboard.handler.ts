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
} from '../types/dashboard.types';
import { startOfMonth, endOfDay, startOfDay, format } from 'date-fns';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';
import { convertBufferToAddress } from 'src/libs/convertBufferToAddress';

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
      const [
        voucherStats,
        endUserStats,
        transactionStats,
        pointsData,
        thbStats,
      ] = await Promise.all([
        this.getVoucherStats(merchantId),
        this.getEndUserStats(merchantId),
        this.getTransactionStats(merchantId),
        this.getPointsData(merchantId),
        this.getThbStats(merchantId),
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
      //     unredeemed: 0,
      //     redeemed: 0,
      //   },
      //   couponValue: {
      //     total: 0,
      //     sold: 0,
      //     unredeemed: 0,
      //     redeemed: 0,
      //   },
      //   couponValueByCurrency: [],
      //   endUsers: {
      //     buyers: 0,
      //     unredeemedUsers: 0,
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
   * Get voucher statistics for the merchant (All Time)
   * - couponCount: นับจาก VoucherCode status (เฉพาะที่ซื้อจาก seller จริงๆ)
   * - couponValue: รวม amount จาก ListingBatch.totalValue/totalItems
   *
   * Logic: นับเฉพาะ codes ที่มี THB_BUY transaction เพื่อยืนยันว่าซื้อมาจริง
   * ไม่ว่า seller จะเป็นตัวเองหรือคนอื่นก็ตาม
   */
  private async getVoucherStats(merchantId: string): Promise<{
    couponCount: MarketerDashboardResponse['couponCount'];
    couponValue: MarketerDashboardResponse['couponValue'];
    couponValueByCurrency: MarketerDashboardResponse['couponValueByCurrency'];
  }> {
    // Step 1: Get all THB_BUY transactions for this merchant to identify actually purchased codes
    const thbBuyTransactions = await this.prisma.transaction.findMany({
      where: {
        merchantId,
        transactionTypeId: TransactionTypeId.THB_BUY,
        voucherCodeId: { not: null },
      },
      select: {
        voucherCodeId: true,
        amount: true,
      },
    });

    // Create set of voucherCodeIds that were actually purchased with THB
    const purchasedCodeIds = new Set<string>();
    const codeIdToPurchaseAmount = new Map<string, number>();
    for (const tx of thbBuyTransactions) {
      if (tx.voucherCodeId) {
        purchasedCodeIds.add(tx.voucherCodeId);
        codeIdToPurchaseAmount.set(tx.voucherCodeId, tx.amount || 0);
      }
    }

    this.logger.debug(
      `[getVoucherStats] Found ${purchasedCodeIds.size} codes with THB_BUY transactions`,
    );

    // Strategy 1: Get vouchers owned by this merchant
    const ownedVouchers = await this.prisma.voucher.findMany({
      where: { merchantId },
      select: { id: true, value: true, thbPurchasePrice: true },
    });

    const ownedVoucherIds = ownedVouchers.map((v) => v.id);

    // Strategy 2: Get voucher codes purchased from seller
    // Use THB_BUY transactions as source of truth (includes codes now owned by customers)
    // Also include codes currently owned by merchant
    const purchasedFromSellerCodes = await this.prisma.voucherCode.findMany({
      where: {
        OR: [
          // Codes currently owned by merchant
          { currentOwnerId: merchantId, currentOwnerType: 'MERCHANT' },
          // Codes purchased via THB_BUY (may now be owned by customer)
          ...(purchasedCodeIds.size > 0
            ? [{ id: { in: Array.from(purchasedCodeIds) } }]
            : []),
        ],
      },
      select: {
        voucherId: true,
      },
      distinct: ['voucherId'],
    });

    // Get unique voucherIds from purchased codes
    const purchasedVoucherIds = purchasedFromSellerCodes.map(
      (c) => c.voucherId,
    );

    // Merge all voucherIds (owned + purchased)
    const allVoucherIds = [
      ...new Set([...ownedVoucherIds, ...purchasedVoucherIds]),
    ];

    this.logger.debug(
      `[getVoucherStats] Found ${ownedVoucherIds.length} owned vouchers + ${purchasedVoucherIds.length} purchased voucher types`,
    );

    if (allVoucherIds.length === 0 && purchasedCodeIds.size === 0) {
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
      };
    }

    // Get all voucher codes that merchant owns or purchased
    // For owned vouchers: get all codes
    // For purchased vouchers: include codes via THB_BUY (may now be owned by customer)
    const allCodes = await this.prisma.voucherCode.findMany({
      where: {
        OR: [
          // Codes from owned vouchers
          ...(ownedVoucherIds.length > 0
            ? [{ voucherId: { in: ownedVoucherIds } }]
            : []),
          // Codes currently owned by merchant
          { currentOwnerId: merchantId, currentOwnerType: 'MERCHANT' },
          // Codes purchased via THB_BUY (may now be owned by customer after sale)
          ...(purchasedCodeIds.size > 0
            ? [{ id: { in: Array.from(purchasedCodeIds) } }]
            : []),
        ],
      },
      select: {
        id: true,
        pointsCost: true,
        pointId: true, // For checking if merchant activated (listed on marketplace)
        point: {
          select: { id: true, symbol: true, name: true }, // For grouping by point
        },
        currency: true,
        currentOwnerId: true,
        currentOwnerType: true, // For checking if sold to customer
        isUsed: true,
        voucherGroupId: true, // For checking if listed on marketplace
        listingBatchId: true, // ใช้เช็คว่าซื้อมาจาก seller หรือไม่
        listingBatch: {
          select: { totalValue: true, totalItems: true }, // For calculating pricePerUnit
        },
        voucher: {
          select: {
            id: true,
            merchantId: true,
            value: true,
            thbPurchasePrice: true,
            currency: true,
          },
        },
      },
    });

    // Deduplicate codes by id
    const uniqueCodes = Array.from(
      new Map(allCodes.map((c) => [c.id, c])).values(),
    );

    this.logger.debug(
      `[getVoucherStats] Found ${uniqueCodes.length} unique voucher codes for merchant`,
    );

    const total = uniqueCodes.length;

    // Filter codes that merchant purchased (has THB_BUY transaction OR currentOwnerType = 'MERCHANT' from seller)
    const purchasedCodes = uniqueCodes.filter((c) => {
      // If has THB_BUY transaction, definitely purchased
      if (purchasedCodeIds.has(c.id)) {
        return true;
      }

      // If currentOwnerType = 'MERCHANT' and from a seller voucher (merchantId != this merchantId)
      if (
        c.currentOwnerType === 'MERCHANT' &&
        c.currentOwnerId === merchantId
      ) {
        // Check if this is from a seller voucher (not owned by merchant)
        if (c.voucher?.merchantId !== merchantId) {
          return true;
        }
      }

      // Fallback: if has listingBatchId, assume purchased
      if (c.listingBatchId) {
        return true;
      }

      return false;
    });

    this.logger.debug(
      `[getVoucherStats] Filtered ${purchasedCodes.length} purchased codes from ${uniqueCodes.length} total codes`,
    );

    // Get purchase price from:
    // 1. THB_BUY transaction amount (most accurate)
    // 2. ListingBatch (totalValue / totalItems)
    // 3. Fallback to thbPurchasePrice
    const getPurchasePrice = (c: (typeof allCodes)[0]) => {
      // First try transaction amount
      const txAmount = codeIdToPurchaseAmount.get(c.id);
      if (txAmount !== undefined) {
        return txAmount;
      }
      // Then try listingBatch
      if (c.listingBatch && c.listingBatch.totalItems > 0) {
        return c.listingBatch.totalValue / c.listingBatch.totalItems;
      }
      // Fallback to thbPurchasePrice
      return c.voucher?.thbPurchasePrice ?? 0;
    };

    // Step 2: Create Map for grouping by currency
    // Build a map from voucherCodeId -> currency for later use
    const codeIdToCurrency = new Map<string, string>();
    const currencyStatsMap = new Map<
      string,
      {
        total: number;
        unsold: number;
        sold: number;
        unredeemed: number;
        redeemed: number;
      }
    >();

    // Track overall THB values from VoucherCode status (เฉพาะ codes ที่ซื้อด้วย THB)
    let totalThbValue = 0;
    let unsoldThbValue = 0;
    let soldThbValue = 0;
    let unredeemedThbValue = 0;
    let redeemedThbValue = 0;

    // Track counts from VoucherCode status (เฉพาะ codes ที่ซื้อด้วย THB)
    let totalCount = 0;
    let unsoldCount = 0;
    let soldCount = 0;
    let unredeemedCount = 0;
    let redeemedCount = 0;

    // Loop 1: Calculate couponCount และ couponValue จาก purchasedCodes เท่านั้น
    // (เฉพาะ codes ที่ซื้อมาจาก seller ด้วย THB)
    // ใช้ Transaction.amount เป็นมูลค่าจริงที่จ่าย (ตรงกับ thbToken.bought)
    // Logic:
    // - unsold = merchant own แต่ยังไม่ได้ activate (pointId = null)
    // - sold = merchant activate แล้ว (pointId != null) = list ลง marketplace ของ merchant
    // - unredeemed = activate แล้ว + customer ซื้อแล้ว + ยังไม่ใช้
    // - redeemed = activate แล้ว + ใช้แล้ว
    for (const code of purchasedCodes) {
      const value = getPurchasePrice(code);
      totalThbValue += value;
      totalCount += 1;

      // Check if merchant has activated this code (pointId != null means merchant listed on marketplace)
      const isMerchantActivated = code.pointId !== null;

      if (isMerchantActivated) {
        // Merchant activated (listed on merchant's marketplace)
        soldThbValue += value;
        soldCount += 1;
        if (code.isUsed) {
          redeemedThbValue += value;
          redeemedCount += 1;
        } else if (code.currentOwnerType === 'CUSTOMER') {
          // Customer bought but not used yet
          unredeemedThbValue += value;
          unredeemedCount += 1;
        }
      } else {
        // Not activated yet (merchant owns but hasn't listed)
        unsoldThbValue += value;
        unsoldCount += 1;
      }
    }

    // Loop 2: Calculate couponValueByCurrency จาก codes ที่ merchant activate แล้วเท่านั้น
    // (นับเฉพาะ codes ที่มี pointId = merchant activated และ list ลง marketplace)
    // Group by pointId แล้วแสดง currency (Point symbol)
    // ใช้ pointsCost เป็นมูลค่า (ราคาขายเป็น Point)
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

    for (const code of uniqueCodes) {
      // Skip codes that haven't been activated by merchant (no pointId)
      if (!code.pointId || !code.point) {
        continue;
      }

      const pointId = code.pointId;
      const currency = code.point.symbol || code.currency || 'UNKNOWN';

      codeIdToCurrency.set(code.id, currency);

      // Initialize point stats if not exists
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

      // Use pointsCost as value (selling price in Points)
      const stats = pointStatsMap.get(pointId)!;
      const value = code.pointsCost ?? 0;
      stats.total += value;

      // For couponValueByCurrency: all codes here are already activated (sold)
      // - sold = activated (always true here since we filtered by pointId)
      // - unredeemed = customer bought but not used
      // - redeemed = used
      stats.sold += value;
      if (code.isUsed) {
        stats.redeemed += value;
      } else if (code.currentOwnerType === 'CUSTOMER') {
        stats.unredeemed += value;
      }
      // Note: unsold stays 0 because we only count activated codes here
    }

    // Convert pointStatsMap to currencyStatsMap for backward compatibility
    for (const [, stats] of pointStatsMap) {
      currencyStatsMap.set(stats.currency, stats);
    }

    this.logger.log(
      `[getVoucherStats] Found ${total} voucher codes for merchant`,
    );
    this.logger.log(
      `[getVoucherStats] Currency groups: ${Array.from(currencyStatsMap.keys()).join(', ')}`,
    );
    this.logger.log(
      `[getVoucherStats] VoucherCode counts: total=${totalCount}, unsold=${unsoldCount}, sold=${soldCount}, pending=${unredeemedCount}, redeemed=${redeemedCount}`,
    );
    this.logger.log(
      `[getVoucherStats] THB values (from VoucherCode status): total=${totalThbValue}, unsold=${unsoldThbValue}, sold=${soldThbValue}, pending=${unredeemedThbValue}, redeemed=${redeemedThbValue}`,
    );

    // Build couponValueByCurrency array (excluding THB)
    const couponValueByCurrency = Array.from(currencyStatsMap.entries())
      .filter(([currency]) => currency !== 'THB')
      .map(([currency, stats]) => ({
        currency,
        total: stats.total,
        unsold: stats.unsold,
        sold: stats.sold,
        unredeemed: stats.unredeemed,
        redeemed: stats.redeemed,
      }));

    this.logger.log(
      `[getVoucherStats] couponValueByCurrency: ${JSON.stringify(couponValueByCurrency)}`,
    );

    return {
      couponCount: {
        total: totalCount, // จำนวน VoucherCode ทั้งหมด
        unsold: unsoldCount, // codes ที่ยังไม่ขาย (ไม่มี currentOwnerId)
        sold: soldCount, // codes ที่ขายแล้ว (มี currentOwnerId)
        unredeemed: unredeemedCount, // ขายแล้วแต่ยังไม่ใช้
        redeemed: redeemedCount, // codes ที่ isUsed = true
      },
      couponValue: {
        total: totalThbValue, // รวม thbPurchasePrice ทั้งหมด
        unsold: unsoldThbValue, // codes ที่ยังไม่ขาย
        sold: soldThbValue, // codes ที่ขายแล้ว (มี currentOwnerId)
        unredeemed: unredeemedThbValue, // ขายแล้วแต่ยังไม่ใช้
        redeemed: redeemedThbValue, // codes ที่ isUsed = true
      },
      couponValueByCurrency,
    };
  }

  /**
   * Get end user statistics for the merchant
   */
  private async getEndUserStats(
    merchantId: string,
  ): Promise<MarketerDashboardResponse['endUsers']> {
    // Strategy 1: Get vouchers owned by this merchant
    const ownedVouchers = await this.prisma.voucher.findMany({
      where: { merchantId },
      select: { id: true },
    });

    const ownedVoucherIds = ownedVouchers.map((v) => v.id);

    // Strategy 2: Get voucher codes purchased from seller
    const purchasedFromSellerCodes = await this.prisma.voucherCode.findMany({
      where: {
        currentOwnerId: merchantId,
        currentOwnerType: 'MERCHANT',
      },
      select: { voucherId: true },
      distinct: ['voucherId'],
    });

    const purchasedVoucherIds = purchasedFromSellerCodes.map(
      (c) => c.voucherId,
    );
    const allVoucherIds = [
      ...new Set([...ownedVoucherIds, ...purchasedVoucherIds]),
    ];

    if (allVoucherIds.length === 0) {
      return {
        total: 0,
        unredeemedUsers: 0,
        redeemedUsers: 0,
      };
    }

    // Get voucher codes that are sold to CUSTOMERS (currentOwnerType = 'CUSTOMER')
    // NOT merchant-owned codes (currentOwnerType = 'MERCHANT' or null)
    const voucherCodes = await this.prisma.voucherCode.findMany({
      where: {
        voucherId: { in: allVoucherIds },
        currentOwnerType: 'CUSTOMER', // Only count end users (customers), not merchants
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
    const unredeemedUsers = new Set(pendingCodes.map((c) => c.currentOwnerId))
      .size;
    const redeemedUsers = new Set(redeemedCodes.map((c) => c.currentOwnerId))
      .size;

    return {
      total: buyers,
      unredeemedUsers,
      redeemedUsers,
    };
  }

  /**
   * Get transaction statistics (All Time)
   */
  private async getTransactionStats(
    merchantId: string,
  ): Promise<MarketerDashboardResponse['transactions']> {
    // Buy Point transactions (TRANSFER type with POINT asset) - All Time
    const transferPointStats = await this.prisma.transaction.aggregate({
      where: {
        merchantId,
        transactionTypeId: TransactionTypeId.TRANSFER,
        type: 'POINT' as any,
      },
      _sum: { amount: true },
    });

    // Redeem Point transactions - All Time
    const redeemStats = await this.prisma.transaction.aggregate({
      where: {
        merchantId,
        transactionTypeId: TransactionTypeId.REDEEM,
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
   * Get THB token statistics for the merchant (All Time)
   */
  private async getThbStats(
    merchantId: string,
  ): Promise<MarketerDashboardResponse['thbToken']> {
    try {
      // Sum of THB_MINT transactions (deposited) - All Time
      const mintStats = await this.prisma.transaction.aggregate({
        where: {
          merchantId,
          transactionTypeId: TransactionTypeId.THB_MINT,
          type: 'THB_TOKEN' as any,
        },
        _sum: { amount: true },
      });

      // Sum of THB_BUY transactions (used for promotion) - All Time
      const buyStats = await this.prisma.transaction.aggregate({
        where: {
          merchantId,
          transactionTypeId: TransactionTypeId.THB_BUY,
          type: 'THB_TOKEN' as any,
        },
        _sum: { amount: true },
      });

      return {
        deposited: mintStats._sum.amount || 0,
        balance: (mintStats._sum.amount || 0) - (buyStats._sum.amount || 0),
        bought: buyStats._sum.amount || 0,
      };
    } catch {
      this.logger.warn(
        '[THB_STATS] Error getting THB stats, returning defaults',
      );
      return {
        deposited: 0,
        balance: 0,
        bought: 0,
      };
    }
  }
}
