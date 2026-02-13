import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { TransactionDBService } from '../services/transaction-db.service';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';
import { convertBufferToAddress } from 'src/libs/convertBufferToAddress';
import {
  TransactionDetail,
  VoucherCodeWithVoucher,
  TransactionParticipant,
  TransactionVoucherInfo,
} from '../types';

@Injectable()
export class GetTransactionByMerchantRef {
  private logger = new Logger(GetTransactionByMerchantRef.name);

  constructor(private db: TransactionDBService) {}

  async execute(
    merchantRef: string,
    status?: string,
    couponId?: string,
  ): Promise<TransactionDetail[]> {
    try {
      this.logger.log(
        `[START] Getting transactions by merchantRef: ${merchantRef}, status: ${status}, couponId: ${couponId}`,
      );

      const transactions = await this.db.getTransactionsByMerchantRef(
        merchantRef,
        status,
        couponId,
      );

      if (!transactions || transactions.length === 0) {
        throw new NotFoundException(
          `No transactions found with merchantRef: ${merchantRef}`,
        );
      }

      const formatParticipant = (
        walletAddress: Uint8Array,
        participantId: string | null,
        displayName: string | null,
      ): TransactionParticipant => {
        return {
          id: participantId ?? '',
          walletAddress: convertBufferToAddress(walletAddress),
          displayName: displayName,
        };
      };

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

      const formatPointInfo = (
        point: any,
        amount: number,
        assetType?: string,
      ) => {
        if (assetType === 'VOUCHER' || !point) {
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

      const results = transactions.map((transaction) => {
        const { merchant, point, voucherCode, ...rest } = transaction;

        // Determine direction based on senderId
        let transactionDirection: 'SENT' | 'RECEIVED' = 'SENT';
        if (rest.senderId) {
          transactionDirection = 'SENT';
        } else if (rest.receiverId) {
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
          senderId: rest.senderId || null,
          receiverId: rest.receiverId || null,
          senderType: rest.senderType || null,
          receiverType: rest.receiverType || null,
          merchant: {
            id: rest.merchantId,
            name: merchant?.name || null,
            imageUrl: merchant?.imageUrl || null,
          },
          point: formatPointInfo(point, rest.amount, rest.type),
          sender: formatParticipant(
            rest.senderAddress,
            rest.senderId,
            merchant?.name || null,
          ),
          receiver: formatParticipant(
            rest.receiverAddress,
            rest.receiverId,
            merchant?.name || null,
          ),
          voucher:
            rest.type === 'POINT'
              ? null
              : formatVoucherInfo(voucherCode as VoucherCodeWithVoucher),
          eventId: rest.eventId || null,
          transactionRefId: rest.transactionRefId || null,
          typeAsset: rest.type || null,
          createdAt: rest.createdAt,
        };

        return result;
      });

      this.logger.log(
        `[SUCCESS] Found ${results.length} transactions for merchantRef: ${merchantRef}`,
      );

      return results;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        `[ERROR] Failed to get transactions by merchantRef: ${error.message}`,
      );
      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }
}
