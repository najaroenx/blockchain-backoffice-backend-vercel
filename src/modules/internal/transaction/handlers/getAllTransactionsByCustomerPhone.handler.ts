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
  ParticipantType,
} from '../types';
import { CustomerDBService } from 'src/modules/internal/customer/services/customer-db.service';
import { PrismaService } from 'prisma/prisma.service';
import {
  resolveVoucherMerchantId,
  resolveVoucherMerchantName,
} from 'src/modules/internal/voucher/utils/resolve-voucher-merchant.util';

@Injectable()
export class GetAllTransactionsByCustomerPhone {
  private logger = new Logger(GetAllTransactionsByCustomerPhone.name);

  constructor(
    private db: TransactionDBService,
    private customerDb: CustomerDBService,
    private prisma: PrismaService,
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

      // Helper function to get displayName based on participant type
      const getDisplayName = async (
        participantId: string | null,
        participantType: ParticipantType | null,
      ): Promise<string> => {
        if (!participantId || !participantType) return '';

        if (participantType === ParticipantType.CUSTOMER) {
          const cust = await this.prisma.customer.findUnique({
            where: { id: participantId },
          });
          return cust?.tel || '';
        } else if (
          participantType === ParticipantType.MERCHANT ||
          participantType === ParticipantType.SELLER
        ) {
          const merch = await this.prisma.merchant.findUnique({
            where: { id: participantId },
          });
          return merch?.name || '';
        }
        return '';
      };

      // Process transactions with async lookup for sender/receiver
      const res = await Promise.all(
        transactions.map(async (transaction) => {
          const { merchant, point, voucherCode, ...rest } = transaction;

          // Lookup sender and receiver info based on their types
          const senderDisplayName = await getDisplayName(
            rest.senderId,
            (rest as any).senderType as ParticipantType | null,
          );
          const receiverDisplayName = await getDisplayName(
            rest.receiverId,
            (rest as any).receiverType as ParticipantType | null,
          );

          const formatParticipant = (
            walletAddress: Uint8Array,
            participantId: string | null,
            displayName: string,
          ): TransactionParticipant => ({
            id: participantId ?? merchant?.id ?? '',
            walletAddress: convertBufferToAddress(walletAddress),
            displayName: displayName,
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

          const resolvedVoucherMerchantId = resolveVoucherMerchantId(
            voucherCode?.voucher as any,
          );
          const resolvedVoucherMerchantName = resolveVoucherMerchantName(
            voucherCode?.voucher as any,
          );

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
              id: rest.merchantId || resolvedVoucherMerchantId,
              name: merchant?.name || resolvedVoucherMerchantName || null,
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
            createdAt: rest.createdAt,
            updatedAt: rest.updatedAt,
          };
        }),
      );

      // Sort: by createdAt desc, then VOUCHER before POINT (if same time)
      const sortedRes = res.sort((a, b) => {
        const dateCompare =
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        if (dateCompare !== 0) return dateCompare;
        // If same createdAt, VOUCHER before POINT
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

      // Re-throw NotFoundException to preserve 404 status
      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }
}
