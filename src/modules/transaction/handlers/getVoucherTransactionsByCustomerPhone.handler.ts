import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { TransactionDBService } from '../services/transaction-db.service';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';
import { convertBufferToAddress } from 'src/libs/convertBufferToAddress';
import { GetTransactionsByCustomerIdResponseType } from '../types';
import { CustomerDBService } from 'src/modules/customer/services/customer-db.service';

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

      // Filter only voucher ownership transactions (VOUCHER_TRANSFER, REDEEM)
      const voucherTransactions = transactions.filter((transaction) => {
        const transactionType = transaction.transactionTypeId;
        return (
          transactionType === 'VOUCHER_TRANSFER' || transactionType === 'REDEEM'
        );
      });

      const filteredCount = totalTransactions - voucherTransactions.length;
      this.logger.log(
        `[SUCCESS] Filtered ${filteredCount} non-voucher transactions out of ${totalTransactions} total. Returning ${voucherTransactions.length} voucher ownership transactions`,
      );

      const res = voucherTransactions.map((transaction) => {
        const { sender, receiver, merchant, point, voucherCode, ...rest } =
          transaction;

        const formatParticipant = (
          customer,
          walletAddress,
          merchantWebsite,
        ) => ({
          id: customer?.id ?? merchant?.id,
          walletAddress: convertBufferToAddress(
            (customer as any)?.wallet?.walletAddress
              ? Buffer.from(
                  (customer as any).wallet.walletAddress.replace(/^0x/, ''),
                  'hex',
                )
              : walletAddress,
          ),
          emailOrWebsite: customer?.email ?? merchantWebsite,
        });

        // Determine direction from customer's perspective
        const transactionDirection =
          rest.senderId === customer.id ? 'SENT' : 'RECEIVED';

        return {
          id: rest.id,
          txHash: convertBufferToAddress(rest.txHash),
          senderAddress: convertBufferToAddress(rest.senderAddress),
          receiverAddress: convertBufferToAddress(rest.receiverAddress),
          transactionTypeId: rest.transactionTypeId,
          amount: rest.amount,
          transactionDirection: transactionDirection as 'SENT' | 'RECEIVED',
          merchantId: rest.merchantId,
          merchantName: merchant?.name || null,
          point: {
            id: point.id,
            name: point.name,
            symbol: point.symbol,
            imageUrl: point.imageUrl || null,
          },
          sender: formatParticipant(
            sender,
            rest.senderAddress,
            merchant?.website,
          ),
          receiver: formatParticipant(
            receiver,
            rest.receiverAddress,
            merchant?.website,
          ),
          voucher: voucherCode?.voucher
            ? {
                id: (voucherCode as any).voucher.id || null,
                name: (voucherCode as any).voucher.name || null,
                valueType: (voucherCode as any).voucher.valueType || null,
                value: (voucherCode as any).voucher.value || null,
                imageUrl: (voucherCode as any).voucher.imageUrl || null,
              }
            : null,
          voucherCodeId: rest.voucherCodeId || null,
          eventId: rest.eventId || null,
          createdAt: rest.createdAt,
        };
      });

      return {
        transactions: res,
        counts: res.length,
      };
    } catch (error) {
      this.logger.error(
        `Error message : ${error.message}, \n Error detail : ${error}`,
      );

      // Re-throw NotFoundException to preserve 404 status
      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }
}
