import { Injectable } from '@nestjs/common';
import { CustomerRepository } from '../customer.repository';
import {
  Customer,
  CustomerMerChant,
  CustomerPoint,
  Merchant,
  Point,
  Prisma,
  Transaction,
} from '@prisma/client';

@Injectable()
export class CustomerDBService {
  constructor(private readonly repository: CustomerRepository) {}

  async updateCustomer(
    customerId: string,
    data: Prisma.CustomerUpdateInput,
  ): Promise<Customer> {
    const customer = await this.repository.update<Customer>({
      where: { id: customerId },
      data,
    });

    return customer;
  }

  async createCustomer(
    data: Omit<Prisma.CustomerCreateInput, 'transaction'>,
  ): Promise<Customer> {
    const customer = await this.repository.create<Customer>({
      data: {
        ...data,
      },
      select: {
        id: true,
        walletAddress: true,
        email: true,
        firstName: true,
        lastName: true,
        tel: true,
      },
    });

    return customer;
  }

  async getCustomersByMerchant(merchantId: string): Promise<Customer[]> {
    const customers = await this.repository.findMany<Customer>({
      where: {
        customerMerChant: {
          some: {
            merchantId,
          },
        },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        walletAddress: true,
      },
    });

    return customers;
  }

  async getCustomersByEmail(
    merchantId: string,
    email: string,
  ): Promise<
    Customer & {
      customerPoints: Array<
        CustomerPoint & {
          point: Point;
        }
      >;
      customerMerChant: CustomerMerChant[];
    }
  > {
    const customer = await this.repository.findFirst<
      Customer & {
        customerPoints: Array<
          CustomerPoint & {
            point: Point;
          }
        >;
        customerMerChant: CustomerMerChant[];
      }
    >({
      where: {
        email,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        walletAddress: true,
        customerMerChant: {
          select: {
            id: true,
            merchantId: true,
            customerId: true,
          },
        },
        customerPoints: {
          where: {
            customer: {
              email,
            },
            point: {
              merchant: {
                id: merchantId,
              },
            },
          },
        },
      },
    });

    return customer;
  }

  async getCustomerById(
    merchantId: string,
    customerId: string,
  ): Promise<
    Customer & {
      receivedTxns: Array<
        Transaction & {
          sender: Customer;
          receiver: Customer;
          merchant: Merchant;
          amount: number;
        }
      >;
      customerPoints: {
        point: Point;
        balances: number;
      }[];
    }
  > {
    const customer = await this.repository.findUnique({
      where: {
        id: customerId,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        walletAddress: true,
        receivedTxns: {
          where: {
            merchantId,
          },
          select: {
            id: true,
            txHash: true,
            createdAt: true,
            transactionTypeId: true,
            receiver: {
              select: {
                email: true,
                walletAddress: true,
              },
            },
            sender: {
              select: {
                email: true,
                walletAddress: true,
              },
            },
            merchant: {
              select: {
                name: true,
                website: true,
              },
            },
            amount: true,
          },
        },
        customerPoints: {
          where: {
            customer: {
              id: customerId,
            },
          },
          select: {
            point: {
              select: {
                name: true,
                symbol: true,
                contractAddress: true,
                decimal: true,
                merchantId: true,
              },
            },
            balances: true,
          },
        },
      },
    });

    return customer;
  }
}
