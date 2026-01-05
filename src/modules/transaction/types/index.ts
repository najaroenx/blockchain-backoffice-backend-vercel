import {
  Customer,
  CustomerPoint,
  Merchant,
  Point,
  Transaction,
  Wallet,
} from '@prisma/client';
import { PointInfo } from 'src/modules/customer/types';

export interface CustomerWithWallet extends Customer {
  wallet?: Wallet | null;
}

export interface VoucherCodeWithVoucher {
  id: string;
  voucher: {
    id: string;
    name: string;
    valueType: string;
    value: number;
    imageUrl?: string;
  };
}

export interface TransactionParticipant {
  id: string;
  walletAddress: string;
  emailOrWebsite: string | null;
}

export interface TransactionVoucherInfo {
  id: string;
  name: string;
  valueType: string;
  value: number;
  imageUrl: string | null;
  voucherCodeId: string | null;
}

export interface TransactionDetail {
  id: string;
  txHash: string;
  senderAddress: string;
  receiverAddress: string;
  transactionTypeId: string;
  amount: number;
  transactionDirection: 'SENT' | 'RECEIVED';
  merchantId: string | null;
  merchantName: string | null;
  point: PointInfo;
  sender: TransactionParticipant;
  receiver: TransactionParticipant;
  voucher: TransactionVoucherInfo | null;
  eventId: string | null;
  transactionRefId: string | null;
  createdAt: Date;
}

export type GetTransactionByMerchantIdResponseType = {
  transactions: Array<
    Omit<
      Transaction,
      | 'txHash'
      | 'receiverAddress'
      | 'senderAddress'
      | 'merchantId'
      | 'pointId'
      | 'updatedAt'
      | 'senderId'
      | 'receiverId'
      | 'merchantSenderId'
      | 'merchantReceiverId'
      | 'voucherCodeId'
    > & {
      txHash: string;
      receiverAddress: string;
      senderAddress: string;
      transactionDirection: 'SENT' | 'RECEIVED';
    }
  >;
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
  merchantSender: Merchant;
  merchantReceiver: Merchant;
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
  merchantSender: Merchant;
  merchantReceiver: Merchant;
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
