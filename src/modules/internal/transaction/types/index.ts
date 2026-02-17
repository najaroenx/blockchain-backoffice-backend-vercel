import {
  Customer,
  Merchant,
  Point,
  Transaction,
  Wallet,
  ParticipantType,
} from '@prisma/client';
import { PointInfo } from 'src/modules/internal/customer/types';
import {
  CustomerOwnedVoucherInfo,
  CustomerOwnedVoucherMerchant,
} from 'src/modules/internal/voucher/types';
import { MerchantRefDetail } from 'src/modules/shared/services/merchant-ref-enrichment.service';

// Re-export ParticipantType for convenience
export { ParticipantType };

export interface CustomerWithWallet extends Customer {
  wallet?: Wallet | null;
}

export interface VoucherCodeWithVoucher {
  id: string;
  currency?: string | null; // VoucherCode currency (fallback for voucher.currency)
  voucher: {
    id: string;
    name: string;
    valueType: string;
    value: number;
    imageUrl?: string;
    tokenId?: string | null;
    description?: string | null;
    currency?: string | null;
    startDate?: Date | null;
    endDate?: Date | null;
    merchantRef?: string | null;
    merchant?: {
      id: string;
      name: string;
      imageUrl?: string | null;
    };
  };
}

export interface TransactionParticipant {
  id: string;
  walletAddress: string;
  displayName: string;
}

// Re-export for backward compatibility
export { CustomerOwnedVoucherInfo, CustomerOwnedVoucherMerchant };

// Transaction-specific merchant info
export interface TransactionMerchant {
  id: string | null;
  name: string | null;
  imageUrl: string | null;
}

// Transaction-specific voucher info (without merchant - use TransactionDetail.merchant)
export interface TransactionVoucherInfo {
  id: string;
  tokenId: string | null;
  name: string;
  description: string | null;
  valueType: string;
  value: number;
  currency: string | null;
  imageUrl: string | null;
  startDate: Date | null;
  endDate: Date | null;
  merchantRef: string | null;
  merchantRefDetail?: MerchantRefDetail | null;
}

export interface TransactionDetail {
  id: string;
  txHash: string;
  senderAddress: string;
  receiverAddress: string;
  transactionTypeId: string;
  amount: number;
  transactionDirection: 'SENT' | 'RECEIVED';
  senderId: string | null;
  receiverId: string | null;
  senderType: ParticipantType | null;
  receiverType: ParticipantType | null;
  merchant: TransactionMerchant;
  point: PointInfo | null;
  sender: TransactionParticipant;
  receiver: TransactionParticipant;
  voucher: TransactionVoucherInfo | null;
  eventId: string | null;
  transactionRefId: string | null;
  typeAsset: string | null;
  createdAt: Date;
}

export type GetTransactionByMerchantIdResponseType = {
  transactions: TransactionDetail[];
  counts: number;
};

export type GetTransactionsByCustomerIdResponseType = {
  transactions: TransactionDetail[];
  counts: number;
};

export type GetTransactionsByCustomerId = Transaction & {
  sender: Customer;
  receiver: Customer;
  merchant: Merchant;
  point: Point;
  voucherCode?: {
    id: string;
    voucher: {
      id: string;
      name: string;
      valueType: string;
      value: number;
      imageUrl?: string;
    };
  } | null;
};

export type GetTransactionsByMerchantId = Transaction & {
  sender: Customer;
  receiver: Customer;
  merchant: Merchant;
  point: Point;
  voucherCode?: {
    id: string;
    voucher: {
      id: string;
      name: string;
      valueType: string;
      value: number;
      imageUrl?: string;
    };
  } | null;
};

export type CreateTransaction = Omit<
  Transaction,
  'txHash' | 'senderAddress' | 'receiverAddress'
> & {
  txHash: string;
  senderAddress: string;
  receiverAddress: string;
};

export type CustomerType = Omit<Customer, 'walletAddress'> & {
  walletAddress: string;
  customerPoints: PointInfo[];
};

export type PointType = Omit<Point, 'contractAddress'> & {
  contractAddress: string;
};
