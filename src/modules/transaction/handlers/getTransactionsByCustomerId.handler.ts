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
  GetTransactionsByCustomerIdResponseType,
  VoucherCodeWithVoucher,
  TransactionParticipant,
  TransactionVoucherInfo,
} from '../types';
import { GetCustomerPhone } from 'src/modules/customer/handlers/getCustomerByPhone.handler';

@Injectable()
export class GetTransactionsByCustomerId {
  private logger = new Logger(GetTransactionsByCustomerId.name);

  constructor(
    private db: TransactionDBService,
    private getCustomerByPhone: GetCustomerPhone,
  ) {}

  async execute(
    merchantId: string,
    phone: string,
  ): Promise<GetTransactionsByCustomerIdResponseType> {
    try {
      // Lookup customer by phone number
      const customerResponse = await this.getCustomerByPhone.execute(
        merchantId,
        phone,
      );

      // Check if customer was found
      if ('message' in customerResponse) {
        throw new NotFoundException(
          `Customer with phone ${phone} not found or not registered with this merchant`,
        );
      }

      const { customer } = customerResponse;

      // Get transactions using customer ID
      const transactions = await this.db.getTransactionsByCustomerId(
        customer.id,
        merchantId,
      );

      const res = transactions.map((transaction) => {
        const { merchant, point, voucherCode, ...rest } = transaction;

        const formatParticipant = (
          walletAddress: Uint8Array,
          participantId: string | null,
          merchantWebsite: string,
        ): TransactionParticipant => ({
          id: participantId ?? merchantId,
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
            merchant.website,
          ),
          receiver: formatParticipant(
            rest.receiverAddress,
            rest.receiverId,
            merchant.website,
          ),
          voucher:
            (rest as any).type === 'POINT'
              ? null
              : formatVoucherInfo(voucherCode),
          eventId: rest.eventId || null,
          transactionRefId: (rest as any).transactionRefId || null,
          typeAsset: (rest as any).type || null,
          senderType: (rest as any).senderType || null,
          receiverType: (rest as any).receiverType || null,
          createdAt: rest.createdAt,
        };
      });

      // Sort: by createdAt desc, then VOUCHER before POINT (if same time)
      const sortedRes = res.sort((a, b) => {
        const dateCompare =
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        if (dateCompare !== 0) return dateCompare;
        if (a.typeAsset === 'VOUCHER' && b.typeAsset === 'POINT') return -1;
        if (a.typeAsset === 'POINT' && b.typeAsset === 'VOUCHER') return 1;
        return 0;
      });

      return {
        transactions: sortedRes,
        counts: sortedRes.length,
      };
    } catch (error) {
      this.logger.error(
        `Error message : ${error.message}, \n Error detail : ${error}`,
      );
      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }

  async executeByCustomerId(
    merchantId: string,
    customerId: string,
  ): Promise<GetTransactionsByCustomerIdResponseType> {
    try {
      // Get transactions using customer ID directly
      const transactions = await this.db.getTransactionsByCustomerId(
        customerId,
        merchantId,
      );

      const res = transactions.map((transaction) => {
        const { merchant, point, voucherCode, ...rest } = transaction;

        const formatParticipant = (
          walletAddress: Uint8Array,
          participantId: string | null,
          merchantWebsite: string,
        ): TransactionParticipant => ({
          id: participantId ?? merchantId,
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
            balance: amount,
          };
        };

        // Determine direction from customer's perspective
        const transactionDirection =
          rest.senderId === customerId ? 'SENT' : 'RECEIVED';

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
            merchant.website,
          ),
          receiver: formatParticipant(
            rest.receiverAddress,
            rest.receiverId,
            merchant.website,
          ),
          voucher:
            (rest as any).type === 'POINT'
              ? null
              : formatVoucherInfo(voucherCode),
          eventId: rest.eventId || null,
          transactionRefId: (rest as any).transactionRefId || null,
          typeAsset: (rest as any).type || null,
          senderType: (rest as any).senderType || null,
          receiverType: (rest as any).receiverType || null,
          createdAt: rest.createdAt,
        };
      });

      // Sort: by createdAt desc, then VOUCHER before POINT (if same time)
      const sortedRes = res.sort((a, b) => {
        const dateCompare =
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        if (dateCompare !== 0) return dateCompare;
        if (a.typeAsset === 'VOUCHER' && b.typeAsset === 'POINT') return -1;
        if (a.typeAsset === 'POINT' && b.typeAsset === 'VOUCHER') return 1;
        return 0;
      });

      return {
        transactions: sortedRes,
        counts: sortedRes.length,
      };
    } catch (error) {
      this.logger.error(
        `Error message : ${error.message}, \n Error detail : ${error}`,
      );
      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }
}
