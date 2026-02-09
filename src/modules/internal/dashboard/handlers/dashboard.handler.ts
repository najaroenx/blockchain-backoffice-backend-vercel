import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { startOfDay, endOfDay, startOfYear, endOfYear } from 'date-fns';
import { PrismaService } from 'prisma/prisma.service';
import { GetTransactionsByMerchantId } from 'src/modules/internal/transaction/handlers/getTransactionsByMerchantId.handler';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';
import { TransactionTypeId } from 'src/constants/transaction-types.enum';
@Injectable()
export class DashboardService {
  private logger = new Logger(DashboardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly getTransactionsByMerchantId: GetTransactionsByMerchantId,
  ) {}

  async execute(merchantId: string): Promise<any> {
    try {
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

      const allTransactionsPromise =
        this.getTransactionsByMerchantId.execute(merchantId);

      // Count transactions for today and group transactions by month
      const transactionMonthlyCountsPromise = this.prisma.transaction.findMany({
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
          transactionTypeId: TransactionTypeId.REDEEM,
          createdAt: { gte: startOfToday, lte: endOfToday },
        },
      });

      const transactionsTodayTransferPromise = this.prisma.transaction.count({
        where: {
          merchantId,
          transactionTypeId: TransactionTypeId.TRANSFER,
          createdAt: { gte: startOfToday, lte: endOfToday },
        },
      });

      const allTransactionsTodayPromise = this.prisma.transaction.count({
        where: {
          merchantId,
          createdAt: { gte: startOfToday, lte: endOfToday },
        },
      });

      // Execute all promises concurrently
      const [
        customers,
        transactionsMonthly,
        transactionsTodayByRedeem,
        transactionsTodayByTransfer,
        allTransactions,
        allTransactionsToday,
      ] = await Promise.all([
        customerCountPromise,
        transactionMonthlyCountsPromise,
        transactionsTodayRedeemPromise,
        transactionsTodayTransferPromise,
        allTransactionsPromise,
        allTransactionsTodayPromise,
      ]);

      // Filter and group transactions by type
      const txMonthly = transactionsMonthly.filter(
        (tx) => tx.createdAt >= startOfCurrentYear,
      );
      const txRedeemByMonthly = txMonthly.filter(
        (tx) => tx.transactionTypeId === TransactionTypeId.REDEEM,
      );
      const txTransferByMonthly = txMonthly.filter(
        (tx) => tx.transactionTypeId === TransactionTypeId.TRANSFER,
      );

      // Group transactions by month
      const totalTransactionsByMonthly =
        this.groupTransactionsByMonth(txMonthly);
      const totalTransactionsRedeemByMonthly =
        this.groupTransactionsByMonth(txRedeemByMonthly);
      const totalTransactionsTransferByMonthly =
        this.groupTransactionsByMonth(txTransferByMonthly);

      return {
        customerWallet: customers,
        transactionsToday: allTransactionsToday,
        totalRedeem: transactionsTodayByRedeem,
        totalTransfer: transactionsTodayByTransfer,
        transactionsMonthly: this.formatMonthlyData(totalTransactionsByMonthly),
        transactionsRedeemMonthly: this.formatMonthlyData(
          totalTransactionsRedeemByMonthly,
        ),
        transactionsTransferMonthly: this.formatMonthlyData(
          totalTransactionsTransferByMonthly,
        ),
        allTransactions,
      };
    } catch (error) {
      this.logger.error(
        `Error message : ${error.message}, \n Error detail : ${error}`,
      );

      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
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
