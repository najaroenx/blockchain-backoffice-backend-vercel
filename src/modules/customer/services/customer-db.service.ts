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
  Wallet,
} from '@prisma/client';
import { PageOptionsDto } from 'src/common/dtos';

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
        walletId: true,
        email: true,
        firstName: true,
        lastName: true,
        tel: true,
      },
    });

    return customer;
  }

  async getCustomersByMerchant(
    merchantId: string,
    pageOptionsDto: PageOptionsDto,
  ): Promise<{ customers: (Customer & { wallet?: Wallet | null })[]; count: number }> {
    const count = await this.repository.count({
      where: {
        customerMerChant: {
          some: {
            merchantId,
          },
        },
      },
    });

    const customers = await this.repository.findMany<Customer>({
      where: {
        customerMerChant: {
          some: {
            merchantId,
          },
        },
      },
      take: pageOptionsDto.take,
      skip: pageOptionsDto.skip,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        wallet: true,
      },
    });

    return { customers, count };
  }

  async getCustomersByEmail(
    merchantId: string,
    email: string,
  ): Promise<
    Customer & {
      wallet?: Wallet | null;
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
        wallet: true,
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

  async getCustomersByPhone(
    merchantId: string,
    phone: string,
  ): Promise<
    Customer & {
      wallet?: Wallet | null;
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
        tel: phone,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        wallet: true,
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
              tel: phone,
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
      wallet?: Wallet | null;
      receivedTxns: Array<
        Transaction & {
          sender: Customer;
          receiver: Customer;
          merchant: Merchant;
          amount: number;
        }
      >;
      sentTxns: Array<
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
    const customer = await this.repository.findUnique<
      Customer & {
        sentTxns: Array<
          Transaction & {
            sender: Customer;
            receiver: Customer;
            merchant: Merchant;
            amount: number;
          }
        >;
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
    >({
      where: {
        id: customerId,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        wallet: true,
        sentTxns: {
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
                wallet: true,
              },
            },
            sender: {
              select: {
                email: true,
                wallet: true,
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
                wallet: true,
              },
            },
            sender: {
              select: {
                email: true,
                wallet: true,
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

  async getCustomerByPhoneDetailed(phone: string): Promise<any> {
    const customer = await this.repository.findFirst({
      where: {
        tel: phone,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        tel: true,
        createdAt: true,
        updatedAt: true,
        wallet: true,
        customerMerChant: {
          select: {
            merchantId: true,
            merchant: {
              select: {
                id: true,
                name: true,
                description: true,
              },
            },
          },
        },
        customerPoints: {
          select: {
            balances: true,
            point: {
              select: {
                id: true,
                name: true,
                merchantId: true,
              },
            },
          },
        },
        ownedVouchers: {
          select: {
            id: true,
            code: true,
            voucherId: true,
            pointsCost: true,
            currency: true,
            voucher: {
              select: {
                name: true,
                description: true,
                imageUrl: true,
                value: true,
                valueType: true,
                merchantId: true,
              },
            },
          },
        },
      },
    });

    return customer;
  }
}
