import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { TransactionDBService } from '../services/transaction-db.service';
import { GetTransactionsByCustomerIdResponseType } from '../types';
import { CustomerDBService } from 'src/modules/internal/customer/services/customer-db.service';
import { formatTransactionDetail } from '../utils/transaction-response.util';
import { logAndRethrowOrInternalError } from 'src/common/utils/handler-error.util';

@Injectable()
export class GetVoucherTransactionsByCustomerPhone {
  private logger = new Logger(GetVoucherTransactionsByCustomerPhone.name);

  constructor(
    private db: TransactionDBService,
    private customerDb: CustomerDBService,
  ) {}

  async execute(
    merchantId: string | null,
    phone: string,
  ): Promise<GetTransactionsByCustomerIdResponseType> {
    try {
      const scope = merchantId ? `merchant: ${merchantId}` : 'all merchants';
      this.logger.log(
        `[START] Getting voucher transactions for ${scope}, phone: ${phone}`,
      );

      // Lookup customer by phone number
      const customer = await this.customerDb.getCustomerByPhoneDetailed(phone);

      // Check if customer was found
      if (!customer) {
        throw new NotFoundException(`Customer with phone ${phone} not found`);
      }

      // Get transactions - use getAllTransactionsByCustomerId if no merchantId filter
      const transactions = merchantId
        ? await this.db.getTransactionsByCustomerId(customer.id, merchantId)
        : await this.db.getAllTransactionsByCustomerId(customer.id);

      const totalTransactions = transactions.length;

      // Filter to get only VOUCHER transactions
      // New structure: type=VOUCHER for voucher transactions
      // Also filter by transactionTypeId for backward compatibility with legacy data
      const voucherTransactions = transactions.filter((transaction) => {
        const assetType = (transaction as any).type;
        // Include if type=VOUCHER
        return assetType === 'VOUCHER';
      });

      const filteredCount = totalTransactions - voucherTransactions.length;
      this.logger.log(
        `[SUCCESS] Filtered ${filteredCount} non-voucher transactions out of ${totalTransactions} total. Returning ${voucherTransactions.length} voucher transactions`,
      );

      const res = voucherTransactions.map((transaction) => {
        const { merchant, ...rest } = transaction;

        const participantDisplayName = (
          participantId: string | null,
          participantType: string | null,
        ) =>
          participantType === 'CUSTOMER'
            ? participantId === customer.id
              ? phone
              : null
            : participantType === 'MERCHANT' || participantType === 'SELLER'
              ? merchant?.name || null
              : null;

        return formatTransactionDetail(transaction, {
          perspectiveId: customer.id,
          fallbackParticipantId: merchant?.id,
          senderDisplayName: participantDisplayName(
            rest.senderId,
            (rest as any).senderType || null,
          ),
          receiverDisplayName: participantDisplayName(
            rest.receiverId,
            (rest as any).receiverType || null,
          ),
          resolveVoucherMerchant: true,
        });
      });

      return {
        transactions: res,
        counts: res.length,
      };
    } catch (error) {
      logAndRethrowOrInternalError(this.logger, error, [NotFoundException]);
    }
  }
}
