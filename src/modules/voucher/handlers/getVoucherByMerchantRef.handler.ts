import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { convertBufferToAddress } from 'src/libs/convertBufferToAddress';
import {
  GetTransactionsByCustomerIdResponseType,
  TransactionDetail,
  TransactionParticipant,
  TransactionVoucherInfo,
  CustomerWithWallet,
  VoucherCodeWithVoucher,
} from 'src/modules/transaction/types';
import { TransactionTypeId } from 'src/constants/transaction-types.enum';

@Injectable()
export class GetVoucherByMerchantRef {
  private logger = new Logger(GetVoucherByMerchantRef.name);
  constructor(private readonly prisma: PrismaService) {}

  async execute(
    merchantRef: string,
  ): Promise<GetTransactionsByCustomerIdResponseType> {
    try {
      // 1. Find voucher by merchantRef
      const voucher = await this.prisma.voucher.findFirst({
        where: {
          merchantRef: merchantRef,
        },
        include: {
          merchant: {
            select: {
              id: true,
              name: true,
              website: true,
              wallet: {
                select: {
                  walletAddress: true,
                },
              },
            },
          },
          voucherCodes: {
            select: {
              id: true,
            },
          },
        },
      });

      if (!voucher) {
        throw new NotFoundException(
          `Voucher with merchantRef ${merchantRef} not found`,
        );
      }

      // 2. Get voucherCode IDs
      const voucherCodeIds = voucher.voucherCodes.map((vc) => vc.id);

      if (voucherCodeIds.length === 0) {
        return {
          transactions: [],
          counts: 0,
        };
      }

      // 3. Find REDEEM transactions related to these voucherCodes (type: VOUCHER)
      const transactions = await this.prisma.transaction.findMany({
        where: {
          voucherCodeId: { in: voucherCodeIds },
          transactionTypeId: TransactionTypeId.REDEEM,
          type: 'VOUCHER',
        },
        include: {
          sender: {
            include: {
              wallet: true,
            },
          },
          receiver: {
            include: {
              wallet: true,
            },
          },
          merchant: true,
          point: true,
          voucherCode: {
            include: {
              voucher: {
                select: {
                  id: true,
                  name: true,
                  valueType: true,
                  value: true,
                  imageUrl: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      // 4. Transform transactions to TransactionDetail format
      const transformedTransactions: TransactionDetail[] = transactions.map(
        (transaction) => {
          const { sender, receiver, merchant, point, voucherCode, ...rest } =
            transaction;

          const formatParticipant = (
            customer: CustomerWithWallet | null,
            walletAddress: Uint8Array,
            merchantWebsite: string,
          ): TransactionParticipant => ({
            id: customer?.id ?? voucher.merchant.id,
            walletAddress: convertBufferToAddress(
              customer?.wallet?.walletAddress
                ? Buffer.from(
                    customer.wallet.walletAddress.replace(/^0x/, ''),
                    'hex',
                  )
                : walletAddress,
            ),
            emailOrWebsite: customer?.email ?? merchantWebsite,
          });

          const formatVoucherInfo = (
            voucherCode: VoucherCodeWithVoucher | null,
          ): TransactionVoucherInfo | null => {
            if (!voucherCode?.voucher) return null;

            return {
              id: voucherCode.voucher.id,
              tokenId: (voucherCode.voucher as any).tokenId || null,
              name: voucherCode.voucher.name,
              description: (voucherCode.voucher as any).description || null,
              valueType: voucherCode.voucher.valueType,
              value: voucherCode.voucher.value,
              currency: (voucherCode.voucher as any).currency || null,
              imageUrl: voucherCode.voucher.imageUrl || null,
              startDate: (voucherCode.voucher as any).startDate || null,
              endDate: (voucherCode.voucher as any).endDate || null,
              merchantRef: (voucherCode.voucher as any).merchantRef || null,
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

            if (!point) return null;

            return {
              id: point.id,
              name: point.name,
              symbol: point.symbol,
              merchantId: point.merchantId || null,
              imageUrl: point.imageUrl || null,
              balance: amount,
            };
          };

          // Default direction for voucher transactions
          const transactionDirection: 'SENT' | 'RECEIVED' = rest.senderId
            ? 'SENT'
            : 'RECEIVED';

          return {
            id: rest.id,
            txHash: convertBufferToAddress(rest.txHash),
            senderAddress: convertBufferToAddress(rest.senderAddress),
            receiverAddress: convertBufferToAddress(rest.receiverAddress),
            transactionTypeId: rest.transactionTypeId,
            amount: rest.amount,
            transactionDirection,
            merchant: {
              id: rest.merchantId || voucher.merchant.id,
              name: merchant?.name || voucher.merchant.name || null,
              imageUrl:
                (merchant as any)?.imageUrl ||
                (voucher.merchant as any)?.imageUrl ||
                null,
            },
            point: formatPointInfo(
              point,
              rest.amount,
              rest.transactionTypeId,
              (rest as any).type,
            ),
            sender: formatParticipant(
              sender as CustomerWithWallet,
              rest.senderAddress,
              merchant?.website || voucher.merchant.website || '',
            ),
            receiver: formatParticipant(
              receiver as CustomerWithWallet,
              rest.receiverAddress,
              merchant?.website || voucher.merchant.website || '',
            ),
            voucher: formatVoucherInfo(voucherCode as VoucherCodeWithVoucher),
            eventId: rest.eventId || null,
            transactionRefId: (rest as any).transactionRefId || null,
            typeAsset: (rest as any).type || null,
            createdAt: rest.createdAt,
          };
        },
      );

      return {
        transactions: transformedTransactions,
        counts: transformedTransactions.length,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        `Error fetching transactions for merchantRef ${merchantRef}:`,
        error,
      );
      throw new InternalServerErrorException(
        'Error fetching transactions by merchantRef',
      );
    }
  }
}
