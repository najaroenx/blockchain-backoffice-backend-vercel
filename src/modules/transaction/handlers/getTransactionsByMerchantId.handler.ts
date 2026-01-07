import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { TransactionDBService } from '../services/transaction-db.service';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';
import { TransactionTypeId } from 'src/constants/transaction-types.enum';
import { convertBufferToAddress } from 'src/libs/convertBufferToAddress';
import {
  GetTransactionByMerchantIdResponseType,
  VoucherCodeWithVoucher,
  TransactionVoucherInfo,
} from '../types';

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
          assetType?: string,
        ) => {
          if (!point) return null;

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
            id: merchantId,
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
            merchant.website,
          ),
          receiver: formatParticipant(
            receiver,
            rest.receiverAddress,
            merchant.website,
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
      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }
}
