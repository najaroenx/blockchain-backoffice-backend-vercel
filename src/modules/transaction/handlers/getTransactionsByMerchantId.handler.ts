import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { TransactionDBService } from '../services/transaction-db.service';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';
import { TransactionTypeId } from 'src/constants/transaction-types.enum';
import { convertBufferToAddress } from 'src/libs/convertBufferToAddress';
import { GetTransactionByMerchantIdResponseType } from '../types';

@Injectable()
export class GetTransactionsByMerchantId {
  private logger = new Logger(GetTransactionsByMerchantId.name);

  constructor(private db: TransactionDBService) {}

  async execute(
    merchantId: string,
  ): Promise<GetTransactionByMerchantIdResponseType> {
    try {
      const transactions =
        await this.db.getTransactionsByMerchantId(merchantId);

      const res = transactions.map((transaction) => {
        const { sender, receiver, merchant, point, voucherCode, ...rest } =
          transaction;

        const formatParticipant = (
          customer,
          walletAddress,
          merchantWebsite,
        ) => ({
          id: customer?.id ?? merchantId,
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
        ) => {
          if (!point) return null;

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

        // Determine transaction direction from merchant's perspective
        // SENT when:
        // - senderId === null (B2C: Merchant sent to customer)
        // - merchantSenderId === merchantId (Merchant is sender, e.g., bought voucher)
        // RECEIVED when:
        // - senderId !== null (Customer sent to merchant)
        // - merchantReceiverId === merchantId (Merchant is receiver, e.g., received voucher)
        const transactionDirection =
          rest.senderId === null ||
          (rest as any).merchantSenderId === merchantId
            ? 'SENT'
            : 'RECEIVED';

        return {
          id: rest.id,
          txHash: convertBufferToAddress(rest.txHash),
          senderAddress: convertBufferToAddress(rest.senderAddress),
          receiverAddress: convertBufferToAddress(rest.receiverAddress),
          transactionTypeId: rest.transactionTypeId,
          amount: rest.amount,
          transactionDirection: transactionDirection as 'SENT' | 'RECEIVED',
          type: (rest as any).type || null,
          point: formatPointInfo(point, rest.amount, rest.transactionTypeId),
          sender: formatParticipant(
            sender,
            rest.senderAddress,
            merchant.website,
          ),
          receiver: formatParticipant(
            receiver,
            rest.receiverAddress,
            merchant.website,
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
      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }
}
