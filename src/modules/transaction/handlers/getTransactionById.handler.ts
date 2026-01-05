import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { TransactionDBService } from '../services/transaction-db.service';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';
import { convertBufferToAddress } from 'src/libs/convertBufferToAddress';
import { TransactionTypeId } from 'src/constants/transaction-types.enum';
import {
  TransactionDetail,
  CustomerWithWallet,
  VoucherCodeWithVoucher,
  TransactionParticipant,
  TransactionVoucherInfo,
} from '../types';

@Injectable()
export class GetTransactionById {
  private logger = new Logger(GetTransactionById.name);

  constructor(private db: TransactionDBService) {}

  async execute(transactionId: string): Promise<TransactionDetail> {
    try {
      this.logger.log(`[START] Getting transaction by id: ${transactionId}`);

      // Get transaction by ID
      const transaction = await this.db.getTransactionById(transactionId);

      if (!transaction) {
        throw new NotFoundException(
          `Transaction with id ${transactionId} not found`,
        );
      }

      const { sender, receiver, merchant, point, voucherCode, ...rest } =
        transaction;

      const formatParticipant = (
        customer: CustomerWithWallet | null,
        walletAddress: Uint8Array,
        merchantWebsite: string | null,
      ): TransactionParticipant | null => {
        if (!customer && !merchant) return null;

        return {
          id: customer?.id ?? merchant?.id,
          walletAddress: convertBufferToAddress(
            customer?.wallet?.walletAddress
              ? Buffer.from(
                  customer.wallet.walletAddress.replace(/^0x/, ''),
                  'hex',
                )
              : walletAddress,
          ),
          emailOrWebsite: customer?.email ?? merchantWebsite,
        };
      };

      const formatVoucherInfo = (
        voucherCode: VoucherCodeWithVoucher | null,
      ): TransactionVoucherInfo | null => {
        if (!voucherCode?.voucher) return null;

        return {
          id: voucherCode.voucher.id,
          name: voucherCode.voucher.name,
          valueType: voucherCode.voucher.valueType,
          value: voucherCode.voucher.value,
          imageUrl: voucherCode.voucher.imageUrl || null,
          voucherCodeId: voucherCode.id || null,
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

      // Determine direction if sender/receiver exists
      let transactionDirection: 'SENT' | 'RECEIVED' = 'SENT';
      if (rest.senderId && sender) {
        transactionDirection = 'SENT';
      } else if (rest.receiverId && receiver) {
        transactionDirection = 'RECEIVED';
      }

      const result: TransactionDetail = {
        id: rest.id,
        txHash: convertBufferToAddress(rest.txHash),
        senderAddress: convertBufferToAddress(rest.senderAddress),
        receiverAddress: convertBufferToAddress(rest.receiverAddress),
        transactionTypeId: rest.transactionTypeId,
        amount: rest.amount,
        transactionDirection,
        merchantId: rest.merchantId,
        merchantName: merchant?.name || null,
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
        voucher: formatVoucherInfo(voucherCode),
        eventId: rest.eventId || null,
        transactionRefId: (rest as any).transactionRefId || null,
        createdAt: rest.createdAt,
      };

      this.logger.log(
        `[SUCCESS] Retrieved transaction ${transactionId} successfully`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `[FATAL ERROR] Failed to get transaction: ${error.message}`,
        error.stack,
      );

      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }
}
