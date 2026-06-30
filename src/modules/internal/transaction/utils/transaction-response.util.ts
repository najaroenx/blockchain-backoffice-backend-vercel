import { PrismaService } from 'prisma/prisma.service';
import { convertBufferToAddress } from 'src/libs/convertBufferToAddress';
import {
  resolveVoucherMerchantId,
  resolveVoucherMerchantName,
} from 'src/modules/internal/voucher/utils/resolve-voucher-merchant.util';
import {
  ParticipantType,
  TransactionDetail,
  TransactionMerchant,
  TransactionParticipant,
  TransactionVoucherInfo,
  VoucherCodeWithVoucher,
} from '../types';

interface FormatTransactionOptions {
  perspectiveId?: string;
  fallbackParticipantId?: string | null;
  senderDisplayName?: string | null;
  receiverDisplayName?: string | null;
  merchant?: TransactionMerchant;
  resolveVoucherMerchant?: boolean;
  senderId?: string | null;
  receiverId?: string | null;
  direction?: 'SENT' | 'RECEIVED';
}

export async function getParticipantDisplayName(
  prisma: PrismaService,
  participantId: string | null,
  participantType: string | null,
): Promise<string> {
  if (!participantId || !participantType) {
    return '';
  }

  if (participantType === 'CUSTOMER') {
    const customer = await prisma.customer.findUnique({
      where: { id: participantId },
    });
    return customer?.tel || '';
  }

  if (participantType === 'MERCHANT' || participantType === 'SELLER') {
    const merchant = await prisma.merchant.findUnique({
      where: { id: participantId },
    });
    return merchant?.name || '';
  }

  return '';
}

export function formatVoucherInfo(
  voucherCode: VoucherCodeWithVoucher | null,
): TransactionVoucherInfo | null {
  if (!voucherCode?.voucher) {
    return null;
  }

  return {
    id: voucherCode.voucher.id,
    tokenId: voucherCode.voucher.tokenId || null,
    name: voucherCode.voucher.name,
    description: voucherCode.voucher.description || null,
    valueType: voucherCode.voucher.valueType,
    value: voucherCode.voucher.value,
    currency: voucherCode.voucher.currency || voucherCode.currency || null,
    imageUrl: voucherCode.voucher.imageUrl || null,
    startDate: voucherCode.voucher.startDate || null,
    endDate: voucherCode.voucher.endDate || null,
  };
}

export function formatPointInfo(
  point: any,
  amount: number,
  assetType?: string,
) {
  if (!point || assetType === 'VOUCHER') {
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
}

export function formatParticipant(
  walletAddress: Uint8Array,
  participantId: string | null,
  displayName: string | null | undefined,
  fallbackParticipantId?: string | null,
): TransactionParticipant {
  return {
    id: participantId ?? fallbackParticipantId ?? '',
    walletAddress: convertBufferToAddress(walletAddress),
    displayName: displayName || '',
  };
}

export function formatTransactionDetail(
  transaction: any,
  options: FormatTransactionOptions = {},
): TransactionDetail {
  const { merchant, point, voucherCode, ...rest } = transaction;
  const assetType = (rest as any).type || null;
  const resolvedVoucherMerchantId = options.resolveVoucherMerchant
    ? resolveVoucherMerchantId(voucherCode?.voucher as any)
    : null;
  const resolvedVoucherMerchantName = options.resolveVoucherMerchant
    ? resolveVoucherMerchantName(voucherCode?.voucher as any)
    : null;

  return {
    id: rest.id,
    txHash: convertBufferToAddress(rest.txHash),
    senderAddress: convertBufferToAddress(rest.senderAddress),
    receiverAddress: convertBufferToAddress(rest.receiverAddress),
    transactionTypeId: rest.transactionTypeId,
    amount: rest.amount,
    transactionDirection:
      options.direction ||
      directionFromPerspective(rest, options.perspectiveId),
    senderId:
      options.senderId !== undefined ? options.senderId : rest.senderId || null,
    receiverId:
      options.receiverId !== undefined
        ? options.receiverId
        : rest.receiverId || null,
    senderType: ((rest as any).senderType as ParticipantType) || null,
    receiverType: ((rest as any).receiverType as ParticipantType) || null,
    merchant: options.merchant || {
      id: rest.merchantId || resolvedVoucherMerchantId,
      name: merchant?.name || resolvedVoucherMerchantName || null,
      imageUrl: merchant?.imageUrl || null,
    },
    point: formatPointInfo(point, rest.amount, assetType),
    sender: formatParticipant(
      rest.senderAddress,
      rest.senderId,
      options.senderDisplayName,
      options.fallbackParticipantId,
    ),
    receiver: formatParticipant(
      rest.receiverAddress,
      rest.receiverId,
      options.receiverDisplayName,
      options.fallbackParticipantId,
    ),
    voucher:
      assetType === 'POINT'
        ? null
        : formatVoucherInfo(voucherCode as VoucherCodeWithVoucher),
    eventId: rest.eventId || null,
    transactionRefId: (rest as any).transactionRefId || null,
    typeAsset: assetType,
    createdAt: rest.createdAt,
    updatedAt: rest.updatedAt,
  };
}

export function sortTransactionDetails<
  T extends { createdAt: Date; typeAsset },
>(transactions: T[]): T[] {
  return transactions.sort((a, b) => {
    const dateCompare =
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (dateCompare !== 0) {
      return dateCompare;
    }
    if (a.typeAsset === 'VOUCHER' && b.typeAsset === 'POINT') {
      return -1;
    }
    if (a.typeAsset === 'POINT' && b.typeAsset === 'VOUCHER') {
      return 1;
    }
    return 0;
  });
}

function directionFromPerspective(
  transaction: any,
  perspectiveId?: string,
): 'SENT' | 'RECEIVED' {
  if (!perspectiveId) {
    return transaction.senderId ? 'SENT' : 'RECEIVED';
  }
  return transaction.senderId === perspectiveId ? 'SENT' : 'RECEIVED';
}
