import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { TransactionDBService } from '../services/transaction-db.service';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';
import { TransactionTypeId } from 'src/constants/transaction-types.enum';
import { convertBufferToAddress } from 'src/libs/convertBufferToAddress';
import {
  GetTransactionsByCustomerIdResponseType,
  VoucherCodeWithVoucher,
  TransactionVoucherInfo,
} from '../types';
import { CustomerDBService } from 'src/modules/customer/services/customer-db.service';

@Injectable()
export class GetPointTransactionsByCustomerPhone {
  private logger = new Logger(GetPointTransactionsByCustomerPhone.name);

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
        `[START] Getting point transactions for ${scope}, phone: ${phone}`,
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

      // Filter to get only POINT transactions
      // New structure: type=POINT for point transactions, type=VOUCHER for voucher transactions
      // Also filter by transactionTypeId for backward compatibility with legacy data
      const pointTransactions = transactions.filter((transaction) => {
        const transactionType = transaction.transactionTypeId;
        const assetType = (transaction as any).type;

        // Include if type=POINT (new structure)
        if (assetType === 'POINT') return true;

        // Exclude voucher-only transaction types
        if (
          transactionType === 'VOUCHER_TRANSFER' ||
          transactionType === 'REDEEM'
        ) {
          return false;
        }

        // Include MARKETPLACE_PURCHASE (deprecated but type=POINT)
        // Include other point transaction types: TRANSFER, MINT, BURN, EARN
        return true;
      });

      const filteredCount = totalTransactions - pointTransactions.length;
      this.logger.log(
        `[SUCCESS] Filtered ${filteredCount} voucher transactions out of ${totalTransactions} total. Returning ${pointTransactions.length} point transactions`,
      );

      const res = pointTransactions.map((transaction) => {
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

        const formatPointInfo = (
          point: any,
          amount: number,
          transactionTypeId: string,
          assetType?: string,
        ) => {
          // New structure: check type field first
          if (assetType === 'VOUCHER') {
            return null;
          }

          // Legacy: check transactionTypeId for backward compatibility
          const voucherTransactionTypes = [
            TransactionTypeId.MERCHANT_PURCHASE_FROM_SELLER,
            TransactionTypeId.VOUCHER_TRANSFER,
            TransactionTypeId.VOUCHER_GIFT,
          ];

          if (
            voucherTransactionTypes.includes(
              transactionTypeId as TransactionTypeId,
            )
          ) {
            return null;
          }

          return {
            id: point.id,
            name: point.name,
            symbol: point.symbol,
            merchantId: point.merchantId || null,
            imageUrl: point.imageUrl || null,
            balance: amount,
          };
        };

        // Determine direction from customer's perspective
        const transactionDirection =
          rest.senderId === customer.id ? 'SENT' : 'RECEIVED';

        const formatVoucherInfo = (
          voucherCode: VoucherCodeWithVoucher | null,
        ): TransactionVoucherInfo | null => {
          if (!voucherCode?.voucher) return null;

          return {
            id: voucherCode.voucher.id,
            tokenId: voucherCode.voucher.tokenId || null,
            name: voucherCode.voucher.name,
            description: voucherCode.voucher.description || null,
            valueType: voucherCode.voucher.valueType,
            value: voucherCode.voucher.value,
            currency: voucherCode.voucher.currency || null,
            imageUrl: voucherCode.voucher.imageUrl || null,
            startDate: voucherCode.voucher.startDate || null,
            endDate: voucherCode.voucher.endDate || null,
            merchantRef: voucherCode.voucher.merchantRef || null,
          };
        };

        return {
          id: rest.id,
          txHash: convertBufferToAddress(rest.txHash),
          senderAddress: convertBufferToAddress(rest.senderAddress),
          receiverAddress: convertBufferToAddress(rest.receiverAddress),
          transactionTypeId: rest.transactionTypeId,
          amount: rest.amount,
          transactionDirection: transactionDirection as 'SENT' | 'RECEIVED',
          merchant: {
            id: rest.merchantId,
            name: merchant?.name || null,
            imageUrl: merchant?.imageUrl || null,
          },
          point: formatPointInfo(
            point,
            rest.amount,
            rest.transactionTypeId,
            (rest as any).type,
          ),
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
          voucher: formatVoucherInfo(voucherCode as VoucherCodeWithVoucher),
          eventId: rest.eventId || null,
          transactionRefId: (rest as any).transactionRefId || null,
          typeAsset: (rest as any).type || null,
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
