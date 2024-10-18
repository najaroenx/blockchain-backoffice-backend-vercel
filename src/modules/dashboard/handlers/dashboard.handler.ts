import { Injectable } from '@nestjs/common';
import { CustomerDBService } from 'src/modules/customer/services/customer-db.service';
import { TransactionDBService } from 'src/modules/transaction/services/transaction-db.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly customerDBService: CustomerDBService,
    private readonly transactionDBService: TransactionDBService,
  ) {}

  async execute(merchantId: string): Promise<any> {
    const customers =
      await this.customerDBService.getCustomersByMerchant(merchantId);

    const transactionsToday =
      await this.transactionDBService.getTransactionsTodayByMerchantId(
        merchantId,
      );

    const transactionsTodayByRedeem =
      await this.transactionDBService.getTransactionsTodayByMerchantIdAndTypeId(
        merchantId,
        'redeem',
      );

    const transactionsTodayByTransfer =
      await this.transactionDBService.getTransactionsTodayByMerchantIdAndTypeId(
        merchantId,
        'transfer',
      );

    return {
      customerWallet: customers.length,
      transactionsToday: transactionsToday.length,
      totalRedeem: transactionsTodayByRedeem.length,
      totalTransfer: transactionsTodayByTransfer.length,
    };
  }
}
