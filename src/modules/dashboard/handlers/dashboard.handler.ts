import { Injectable } from '@nestjs/common';
import { startOfDay, endOfDay, startOfYear, endOfYear } from 'date-fns';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async execute(merchantId: string): Promise<any> {
    const today = new Date();
    const startOfToday = startOfDay(today);
    const endOfToday = endOfDay(today);
    const startOfCurrentYear = startOfYear(today);
    const endOfCurrentYear = endOfYear(today);

    // Count customers for the merchant
    const customerCountPromise = this.prisma.customer.count({
      where: {
        customerMerChant: {
          some: { merchantId },
        },
      },
    });

    // Count transactions for today and group transactions by month
    const transactionCountsPromise = this.prisma.transaction.findMany({
      where: {
        merchantId,
        createdAt: {
          gte: startOfCurrentYear,
          lte: endOfCurrentYear,
        },
      },
    });

    // Count transactions for today by type
    const transactionsTodayRedeemPromise = this.prisma.transaction.count({
      where: {
        merchantId,
        transactionTypeId: 'redeem',
        createdAt: { gte: startOfToday, lte: endOfToday },
      },
    });

    const transactionsTodayTransferPromise = this.prisma.transaction.count({
      where: {
        merchantId,
        transactionTypeId: 'transfer',
        createdAt: { gte: startOfToday, lte: endOfToday },
      },
    });

    // Execute all promises concurrently
    const [
      customers,
      transactions,
      transactionsTodayByRedeem,
      transactionsTodayByTransfer,
    ] = await Promise.all([
      customerCountPromise,
      transactionCountsPromise,
      transactionsTodayRedeemPromise,
      transactionsTodayTransferPromise,
    ]);

    // Filter and group transactions by type
    const txMonthly = transactions.filter(
      (tx) => tx.createdAt >= startOfCurrentYear,
    );
    const txRedeemByMonthly = txMonthly.filter(
      (tx) => tx.transactionTypeId === 'redeem',
    );
    const txTransferByMonthly = txMonthly.filter(
      (tx) => tx.transactionTypeId === 'transfer',
    );

    // Group transactions by month
    const totalTransactionsByMonthly = this.groupTransactionsByMonth(txMonthly);
    const totalTransactionsRedeemByMonthly =
      this.groupTransactionsByMonth(txRedeemByMonthly);
    const totalTransactionsTransferByMonthly =
      this.groupTransactionsByMonth(txTransferByMonthly);

    return {
      customerWallet: customers,
      transactionsToday: transactions.length,
      totalRedeem: transactionsTodayByRedeem,
      totalTransfer: transactionsTodayByTransfer,
      transactionsMonthly: this.formatMonthlyData(totalTransactionsByMonthly),
      transactionsRedeemMonthly: this.formatMonthlyData(
        totalTransactionsRedeemByMonthly,
      ),
      transactionsTransferMonthly: this.formatMonthlyData(
        totalTransactionsTransferByMonthly,
      ),
    };
  }

  private groupTransactionsByMonth = (
    transactions,
  ): { year: any; month: any; amountTransactions: number }[] => {
    const groupedData = transactions.reduce((acc, transaction) => {
      const month = transaction.createdAt.getMonth();
      const year = transaction.createdAt.getFullYear();

      const key = `${year}-${month + 1}`;

      if (!acc[key]) {
        acc[key] = { amountTransactions: 0, year, month: month + 1 };
      }

      acc[key].amountTransactions += 1;

      return acc;
    }, {});

    return Object.values(groupedData);
  };

  private formatMonthlyData = (data: any[]) => {
    return {
      months: data.map(
        (item) => `${item.year}-${String(item.month).padStart(2, '0')}`,
      ),
      amountTransactions: data.map((item) => item.amountTransactions),
    };
  };
}
