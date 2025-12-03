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
    phone: string;
    walletAddress: string;
    customerPoints: Array<
      CustomerPoint & {
        point: Point;
      }
    >;
    ownedVouchers?: any[];
  };
};

export type GetCustomerByPhoneResponseNotFoundType = {
  message: string;
  error?: string;
  data: {
    url: string;
    callbackUrl: string;
    merchantId?: string;
  } | null;
};

export type GetCustomerPhoneDevForRespType = {
  message: string;
  statusCode: number;
  data: Omit<Customer, 'walletAddress'> & {
    phone: string;
    walletAddress: string;
    customerPoints: Array<
      CustomerPoint & {
        point: Point;
      }
    >;
    customerMerChant: Array<{
      id: string;
      merchantId: string;
      customerId: string;
      merchant: {
        id: string;
        name: string;
        description: string | null;
        imageUrl: string | null;
        location: string | null;
        website: string;
        tel: string;
      };
    }>;
    ownedVouchers?: any[];
  };
};
export type GetCustomerByPhoneResponseTypeV1 = {
  phone: string;
  walletAddress: string;
  customerPoints: Array<
    CustomerPoint & {
      point: Point;
    }
  >;
  customerMerChant: Array<{
    id: string;
    merchantId: string;
    customerId: string;
    merchant: {
      id: string;
      name: string;
      description: string | null;
      imageUrl: string | null;
      location: string | null;
      website: string;
      tel: string;
    };
  }>;
  ownedVouchers?: any[];
};
