import { Customer, CustomerPoint, Point } from '@prisma/client';

export type GetCustomersByMerchantIdResponseType = {
  customers: Array<Omit<Customer, 'walletAddress'> & { walletAddress: string }>;
  counts: number;
};

export type GetCustomersIdResponseType = {
  customer: Omit<Customer, 'walletAddress'> & {
    walletAddress: string;
    customerPoints: {
      name: string;
      symbol: string;
      decimal: number;
      merchantId: string;
      balances: number;
    }[];
    transactions: {
      id: string;
      sender: string;
      receiver: string;
      txHash: string;
      amount: number;
      createdAt: Date;
      transactionTypeId: string;
    }[];
  };
};

export type GetCustomerByEmailResponseType = {
  customer: Omit<Customer, 'walletAddress'> & {
    walletAddress: string;
    customerPoints: Array<
      CustomerPoint & {
        point: Point;
      }
    >;
  };
};
