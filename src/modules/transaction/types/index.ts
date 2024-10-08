import {
  Customer,
  CustomerPoint,
  Merchant,
  Point,
  Transaction,
} from '@prisma/client';

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
    > & {
      txHash: string;
      receiverAddress: string;
      senderAddress: string;
    }
  >;
  counts: number;
};

export type GetTransactionsByCustomerIdResponseType = {
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
    > & {
      txHash: string;
      receiverAddress: string;
      senderAddress: string;
    }
  >;
  counts: number;
};

export type GetTransactionsByCustomerId = Transaction & {
  sender: Customer;
  receiver: Customer;
  merchant: Merchant;
  point: Point;
};

export type GetTransactionsByMerchantId = Transaction & {
  sender: Customer;
  receiver: Customer;
  merchant: Merchant;
  point: Point;
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
  customerPoints: Array<
    CustomerPoint & {
      point: Point;
    }
  >;
};

export type PointType = Omit<Point, 'contractAddress'> & {
  contractAddress: string;
};
