import { randomUUID } from 'crypto';
import {
  AssetType,
  TransactionTypeId,
} from 'src/constants/transaction-types.enum';

interface WalletLike {
  walletAddress: string;
}

interface MerchantLike {
  id: string;
  wallet: WalletLike;
}

interface CustomerLike {
  id: string;
  wallet: WalletLike;
}

interface VoucherLike {
  merchantRef?: string | null;
}

export interface WriteDirectVoucherTransferLedgerParams {
  prisma: any;
  voucherCodeIds: string[];
  merchant: MerchantLike;
  customer: CustomerLike;
  voucher: VoucherLike;
  txHash: string;
  transactionRefId?: string;
}

function hexAddressToBuffer(address: string): Buffer {
  return Buffer.from(address.replace(/^0x/, ''), 'hex');
}

function txHashToBuffer(txHash: string): Buffer {
  return Buffer.from(txHash.replace(/^0x/, ''), 'hex');
}

export async function writeDirectVoucherTransferLedger({
  prisma,
  voucherCodeIds,
  merchant,
  customer,
  voucher,
  txHash,
  transactionRefId,
}: WriteDirectVoucherTransferLedgerParams): Promise<any[]> {
  const txHashBuffer = txHashToBuffer(txHash);
  const senderAddressBuffer = hexAddressToBuffer(merchant.wallet.walletAddress);
  const receiverAddressBuffer = hexAddressToBuffer(
    customer.wallet.walletAddress,
  );

  return prisma.$transaction(async (tx) => {
    await tx.voucherCode.updateMany({
      where: { id: { in: voucherCodeIds } },
      data: {
        currentOwnerId: customer.id,
        currentOwnerType: 'CUSTOMER',
        voucherGroupId: null,
      },
    });

    return Promise.all(
      voucherCodeIds.map((codeId) =>
        tx.transaction.create({
          data: {
            txHash: txHashBuffer,
            amount: 1,
            senderAddress: senderAddressBuffer,
            receiverAddress: receiverAddressBuffer,
            merchantId: merchant.id,
            merchantRef: voucher.merchantRef || null,
            voucherCodeId: codeId,
            senderId: merchant.id,
            receiverId: customer.id,
            senderType: 'MERCHANT',
            receiverType: 'CUSTOMER',
            transactionTypeId: TransactionTypeId.TRANSFER,
            type: AssetType.VOUCHER,
            transactionRefId: transactionRefId || randomUUID(),
          },
        }),
      ),
    );
  });
}
