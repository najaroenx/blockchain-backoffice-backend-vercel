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
  CustomerWithWallet,
  VoucherCodeWithVoucher,
  TransactionParticipant,
  TransactionVoucherInfo,
} from '../types';
import { CustomerDBService } from 'src/modules/customer/services/customer-db.service';

@Injectable()
export class GetAllTransactionsByCustomerPhone {
  private logger = new Logger(GetAllTransactionsByCustomerPhone.name);

  constructor(
    private db: TransactionDBService,
    private customerDb: CustomerDBService,
  ) {}

  async execute(
    phone: string,
  ): Promise<GetTransactionsByCustomerIdResponseType> {
    try {
      // Lookup customer by phone number (without merchant filter)
      const customer = await this.customerDb.getCustomerByPhoneDetailed(phone);

      // Check if customer was found
      if (!customer) {
        throw new NotFoundException(`Customer with phone ${phone} not found`);
      }

      // Get all transactions using customer ID (no merchant filter)
      const transactions = await this.db.getAllTransactionsByCustomerId(
        customer.id,
      );

      const res = transactions.map((transaction) => {
        const { merchant, point, voucherCode, ...rest } = transaction;

        const formatParticipant = (
          walletAddress: Uint8Array,
          participantId: string | null,
          merchantWebsite: string | null,
        ): TransactionParticipant => ({
          id: participantId ?? merchant?.id ?? null,
          walletAddress: convertBufferToAddress(walletAddress),
          emailOrWebsite: merchantWebsite,
        });

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
          senderType: (rest as any).senderType || null,
          receiverType: (rest as any).receiverType || null,
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
          voucher: formatVoucherInfo(voucherCode),
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
