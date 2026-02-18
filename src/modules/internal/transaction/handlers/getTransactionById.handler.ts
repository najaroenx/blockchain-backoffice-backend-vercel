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
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class GetTransactionById {
  private logger = new Logger(GetTransactionById.name);

  constructor(
    private db: TransactionDBService,
    private prisma: PrismaService,
  ) {}

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

      const { merchant, point, voucherCode, ...rest } = transaction;

      // Helper function to get displayName based on participant type
      const getDisplayName = async (
        participantId: string | null,
        participantType: string | null,
      ): Promise<string> => {
        if (!participantId || !participantType) return '';

        if (participantType === 'CUSTOMER') {
          const cust = await this.prisma.customer.findUnique({
            where: { id: participantId },
          });
          return cust?.tel || '';
        } else if (
          participantType === 'MERCHANT' ||
          participantType === 'SELLER'
        ) {
          const merch = await this.prisma.merchant.findUnique({
            where: { id: participantId },
          });
          return merch?.name || '';
        }
        return '';
      };

      const senderDisplayName = await getDisplayName(
        rest.senderId,
        (rest as any).senderType,
      );
      const receiverDisplayName = await getDisplayName(
        rest.receiverId,
        (rest as any).receiverType,
      );

      const formatParticipant = (
        walletAddress: Uint8Array,
        participantId: string | null,
        displayName: string,
      ): TransactionParticipant => {
        return {
          id: participantId ?? merchant?.id ?? '',
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
          balance: amount.toString(),
        };
      };

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
          senderDisplayName,
        ),
        receiver: formatParticipant(
          rest.receiverAddress,
          rest.receiverId,
          receiverDisplayName,
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
        updatedAt: rest.updatedAt,
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
