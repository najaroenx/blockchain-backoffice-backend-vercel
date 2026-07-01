import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';
import { TransactionTypeId } from 'src/constants/transaction-types.enum';

/**
 * Response type for merchant's point transfer statistics
 */
interface MerchantPointTransferStats {
  pointId: string;
  pointName: string;
  pointSymbol: string;
  totalTransfers: number;
  totalTransferAmount: number;
}

/**
 * Response type for AIS Point redeem statistics
 */
interface AisPointRedeemStats {
  pointId: string | null;
  pointName: string;
  pointSymbol: string;
  totalRedeemed: number;
  totalRedeemedAmount: number;
}

/**
 * Response type for merchant dashboard statistics
 */
export interface MerchantDashboardStatsResponse {
  vouchers: {
    total: number;
    sold: number;
    soldButNotUsed: number;
    redeemed: number;
  };
  voucherValue: {
    total: number;
    sold: number;
    soldButNotUsed: number;
    redeemed: number;
  };
  endUsers: {
    total: number;
    purchased: number;
    purchasedButNotUsed: number;
    redeemed: number;
  };
  transactions: {
    // Transfer stats for merchant's own points (each point separately, not summed)
    merchantPointTransfers: MerchantPointTransferStats[];
    // Redeem stats for AIS Point only
    aisPointRedeems: AisPointRedeemStats;
  };
  points: {
    list: Array<{
      id: string;
      name: string;
      symbol: string;
      initialSupply: number;
      contractAddress: string;
    }>;
    totalCirculation: number;
  };
  thbToken: {
    deposited: number;
    purchasedFromSeller: number;
  };
}

@Injectable()
export class GetMerchantDashboardStats {
  private readonly logger = new Logger(GetMerchantDashboardStats.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(merchantId: string): Promise<MerchantDashboardStatsResponse> {
    try {
      this.logger.log(
        `[START] Getting dashboard stats for merchant: ${merchantId}`,
      );

      // Validate merchant exists
      const merchant = await this.prisma.merchant.findUnique({
        where: { id: merchantId },
        select: { id: true, name: true },
      });

      if (!merchant) {
        throw new NotFoundException(`Merchant ${merchantId} not found`);
      }

      // Execute all queries in parallel for better performance
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
        `[SUCCESS] Dashboard stats retrieved for merchant: ${merchantId}`,
      );

      return {
        vouchers: voucherStats.vouchers,
        voucherValue: voucherStats.voucherValue,
        endUsers: endUserStats,
        transactions: transactionStats,
        points: pointsData,
        thbToken: thbStats,
      };
    } catch (error) {
      this.logger.error(
        `[ERROR] Failed to get dashboard stats: ${error.message}`,
        error.stack,
      );

      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Get voucher statistics for the merchant
   */
  private async getVoucherStats(merchantId: string): Promise<{
    vouchers: MerchantDashboardStatsResponse['vouchers'];
    voucherValue: MerchantDashboardStatsResponse['voucherValue'];
  }> {
    // Get all vouchers for this merchant
    const vouchers = await this.prisma.voucher.findMany({
      where: { merchantId },
      select: { id: true },
    });

    const voucherIds = vouchers.map((v) => v.id);

    if (voucherIds.length === 0) {
      return {
        vouchers: { total: 0, sold: 0, soldButNotUsed: 0, redeemed: 0 },
        voucherValue: { total: 0, sold: 0, soldButNotUsed: 0, redeemed: 0 },
      };
    }

    // Get all voucher codes for these vouchers
    const allCodes = await this.prisma.voucherCode.findMany({
      where: { voucherId: { in: voucherIds } },
      select: {
        id: true,
        pointsCost: true,
        currentOwnerId: true,
        isUsed: true,
      },
    });

    // Calculate statistics
    const total = allCodes.length;
    const soldCodes = allCodes.filter((c) => c.currentOwnerId !== null);
    const sold = soldCodes.length;
    const soldButNotUsedCodes = soldCodes.filter((c) => !c.isUsed);
    const soldButNotUsed = soldButNotUsedCodes.length;
    const redeemedCodes = allCodes.filter((c) => c.isUsed);
    const redeemed = redeemedCodes.length;

    // Calculate values (sum of pointsCost)
    const totalValue = allCodes.reduce(
      (sum, c) => sum + (c.pointsCost || 0),
      0,
    );
    const soldValue = soldCodes.reduce(
      (sum, c) => sum + (c.pointsCost || 0),
      0,
    );
    const soldButNotUsedValue = soldButNotUsedCodes.reduce(
      (sum, c) => sum + (c.pointsCost || 0),
      0,
    );
    const redeemedValue = redeemedCodes.reduce(
      (sum, c) => sum + (c.pointsCost || 0),
      0,
    );

    return {
      vouchers: { total, sold, soldButNotUsed, redeemed },
      voucherValue: {
        total: totalValue,
        sold: soldValue,
        soldButNotUsed: soldButNotUsedValue,
        redeemed: redeemedValue,
      },
    };
  }

  /**
   * Get end user statistics for the merchant
   */
  private async getEndUserStats(
    merchantId: string,
  ): Promise<MerchantDashboardStatsResponse['endUsers']> {
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
      return { total, purchased: 0, purchasedButNotUsed: 0, redeemed: 0 };
    }

    // Get distinct customers who own vouchers
    const purchasedCustomers = await this.prisma.voucherCode.findMany({
      where: {
        voucherId: { in: voucherIds },
        currentOwnerId: { not: null },
      },
      select: { currentOwnerId: true, isUsed: true },
    });

    const uniquePurchasedCustomers = new Set(
      purchasedCustomers.map((c) => c.currentOwnerId),
    );
    const purchased = uniquePurchasedCustomers.size;

    // Customers who purchased but haven't used any
    const purchasedButNotUsedCustomerIds = new Set<string>();
    const customerUsageMap = new Map<
      string,
      { hasUsed: boolean; hasUnused: boolean }
    >();

    for (const code of purchasedCustomers) {
      if (!code.currentOwnerId) continue;

      const existing = customerUsageMap.get(code.currentOwnerId) || {
        hasUsed: false,
        hasUnused: false,
      };

      if (code.isUsed) {
        existing.hasUsed = true;
      } else {
        existing.hasUnused = true;
      }

      customerUsageMap.set(code.currentOwnerId, existing);
    }

    // Customers who have unused vouchers (may or may not have used some)
    for (const [customerId, usage] of customerUsageMap) {
      if (usage.hasUnused) {
        purchasedButNotUsedCustomerIds.add(customerId);
      }
    }
    const purchasedButNotUsed = purchasedButNotUsedCustomerIds.size;

    // Customers who have redeemed at least one voucher
    const redeemedCustomerIds = new Set<string>();
    for (const [customerId, usage] of customerUsageMap) {
      if (usage.hasUsed) {
        redeemedCustomerIds.add(customerId);
      }
    }
    const redeemed = redeemedCustomerIds.size;

    return { total, purchased, purchasedButNotUsed, redeemed };
  }

  /**
   * Get transaction statistics:
   * 1. Merchant's own points - Transfer stats only (each point separately)
   * 2. AIS Point - Redeem stats only
   */
  private async getTransactionStats(
    merchantId: string,
  ): Promise<MerchantDashboardStatsResponse['transactions']> {
    // Get all points for this merchant (merchant's own points)
    const merchantPoints = await this.prisma.point.findMany({
      where: { merchantId },
      select: { id: true, name: true, symbol: true },
    });

    // Calculate transfer stats for merchant's own points (each point separately)
    const merchantPointTransfers: MerchantPointTransferStats[] = [];

    for (const point of merchantPoints) {
      // Count TRANSFER transactions for this merchant's point
      const transferStats = await this.prisma.transaction.aggregate({
        where: {
          merchantId,
          pointId: point.id,
          transactionTypeId: TransactionTypeId.TRANSFER,
          type: 'POINT' as any,
        },
        _count: { id: true },
        _sum: { amount: true },
      });

      const transferCount = transferStats._count.id || 0;
      const transferAmount = transferStats._sum.amount || 0;

      merchantPointTransfers.push({
        pointId: point.id,
        pointName: point.name,
        pointSymbol: point.symbol,
        totalTransfers: transferCount,
        totalTransferAmount: transferAmount,
      });
    }

    // Get AIS Point redeem stats
    // Find AIS Point by symbol (could be 'AIS', 'AISPOINT', etc.)
    const aisPoint = await this.prisma.point.findFirst({
      where: {
        OR: [
          { symbol: { contains: 'AIS', mode: 'insensitive' } },
          { name: { contains: 'AIS', mode: 'insensitive' } },
        ],
      },
      select: { id: true, name: true, symbol: true },
    });

    let aisRedeemStats: AisPointRedeemStats = {
      pointId: null,
      pointName: 'AIS Point',
      pointSymbol: 'AIS',
      totalRedeemed: 0,
      totalRedeemedAmount: 0,
    };

    if (aisPoint) {
      // Count REDEEM transactions for AIS Point related to this merchant
      const redeemStats = await this.prisma.transaction.aggregate({
        where: {
          merchantId,
          pointId: aisPoint.id,
          transactionTypeId: TransactionTypeId.REDEEM,
        },
        _count: { id: true },
        _sum: { amount: true },
      });

      aisRedeemStats = {
        pointId: aisPoint.id,
        pointName: aisPoint.name,
        pointSymbol: aisPoint.symbol,
        totalRedeemed: redeemStats._count.id || 0,
        totalRedeemedAmount: redeemStats._sum.amount || 0,
      };
    }

    return {
      merchantPointTransfers,
      aisPointRedeems: aisRedeemStats,
    };
  }

  /**
   * Get points data for the merchant
   */
  private async getPointsData(
    merchantId: string,
  ): Promise<MerchantDashboardStatsResponse['points']> {
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

    const list = points.map((p) => ({
      id: p.id,
      name: p.name,
      symbol: p.symbol,
      initialSupply: p.initialSupply,
      contractAddress: '0x' + Buffer.from(p.contractAddress).toString('hex'),
    }));

    const totalCirculation = points.reduce(
      (sum, p) => sum + p.initialSupply,
      0,
    );

    return { list, totalCirculation };
  }

  /**
   * Get THB token statistics for the merchant
   */
  private async getThbStats(
    merchantId: string,
  ): Promise<MerchantDashboardStatsResponse['thbToken']> {
    try {
      // Sum of THB_MINT transactions (auto-minted THB)
      const mintStats = await this.prisma.transaction.aggregate({
        where: {
          merchantId,
          transactionTypeId: TransactionTypeId.THB_MINT,
          type: 'THB_TOKEN' as any,
        },
        _sum: { amount: true },
      });

      // Sum of THB_BUY transactions (THB spent on seller purchases)
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
        purchasedFromSeller: buyStats._sum.amount || 0,
      };
    } catch (error) {
      // If THB_TOKEN enum doesn't exist in database yet, return default values
      this.logger.warn(
        '[THB_STATS] THB_TOKEN enum not available in database, returning default values',
      );
      return {
        deposited: 0,
        purchasedFromSeller: 0,
      };
    }
  }
}
