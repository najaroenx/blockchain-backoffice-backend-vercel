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
import { CustomerDBService } from 'src/modules/internal/customer/services/customer-db.service';

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
        const { merchant, point, voucherCode, ...rest } = transaction;

        const formatParticipant = (
          walletAddress: Uint8Array,
          participantId: string | null,
          merchantWebsite: string | null,
        ) => ({
          id: participantId ?? merchant?.id ?? null,
          walletAddress: convertBufferToAddress(walletAddress),
          emailOrWebsite: merchantWebsite,
        });

        const formatPointInfo = (
          point: any,
          amount: number,
          transactionTypeId: string,
          assetType?: string,
        ) => {
          // New structure: check type field - if VOUCHER, no point info
          if (assetType === 'VOUCHER') {
            return null;
          }

          return {
            id: point.id,
            name: point.name,
            symbol: point.symbol,
            merchantId: point.merchantId || null,
            imageUrl: point.imageUrl || null,
            balance: amount.toString(),
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
            currency:
              voucherCode.voucher.currency || voucherCode.currency || null,
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
          senderId: rest.senderId || null,
          receiverId: rest.receiverId || null,
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
            rest.senderAddress,
            rest.senderId,
            merchant?.website,
          ),
          receiver: formatParticipant(
            rest.receiverAddress,
            rest.receiverId,
            merchant?.website,
          ),
          voucher:
            (rest as any).type === 'POINT'
              ? null
              : formatVoucherInfo(voucherCode as VoucherCodeWithVoucher),
          eventId: rest.eventId || null,
          transactionRefId: (rest as any).transactionRefId || null,
          typeAsset: (rest as any).type || null,
          senderType: (rest as any).senderType || null,
          receiverType: (rest as any).receiverType || null,
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
