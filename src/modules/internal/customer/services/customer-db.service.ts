import { Injectable } from '@nestjs/common';
import { CustomerRepository } from '../customer.repository';
import {
  Customer,
  CustomerMerChant,
  CustomerPoint,
  Merchant,
  Point,
  Prisma,
  VoucherCode,
  Wallet,
} from '@prisma/client';
import { PageOptionsDto } from 'src/common/dtos';
import { PrismaService } from '../../../../../prisma/prisma.service';

@Injectable()
export class CustomerDBService {
  constructor(
    private readonly repository: CustomerRepository,
    private readonly prisma: PrismaService,
  ) {}

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
  ): Promise<{
    customers: (Customer & { wallet?: Wallet | null })[];
    count: number;
  }> {
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

  async getAllCustomersByMerchantWithWallet(merchantId: string): Promise<{
    customers: (Customer & { wallet?: Wallet | null })[];
    count: number;
  }> {
    const where = {
      customerMerChant: {
        some: {
          merchantId,
        },
      },
    };

    const [count, customers] = await Promise.all([
      this.repository.count({ where }),
      this.repository.findMany<Customer>({
        where,
        include: {
          wallet: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
    ]);

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
      customerMerChant: Array<
        CustomerMerChant & {
          merchant: Merchant;
        }
      >;
      ownedVouchers: VoucherCode[];
    }
  > {
    const customer = await this.repository.findFirst<
      Customer & {
        customerPoints: Array<
          CustomerPoint & {
            point: Point;
          }
        >;
        customerMerChant: Array<
          CustomerMerChant & {
            merchant: Merchant;
          }
        >;
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
            merchant: {
              select: {
                id: true,
                name: true,
                description: true,
                imageUrl: true,
                location: true,
                website: true,
                tel: true,
              },
            },
          },
        },
        customerPoints: {
          where: {
            customer: {
              tel: phone,
            },
          },
          select: {
            balances: true,
            id: true,
            pointId: true,
            point: {
              select: {
                id: true,
                name: true,
                symbol: true,
                merchantId: true,
                imageUrl: true,
              },
            },
          },
        },
      },
    });

    // Query ownedVouchers separately since we removed the relation
    let ownedVouchers: VoucherCode[] = [];
    if (customer) {
      ownedVouchers = await this.prisma.voucherCode.findMany({
        where: {
          currentOwnerId: customer.id,
          currentOwnerType: 'CUSTOMER',
        },
        include: {
          voucher: {
            select: {
              id: true,
              name: true,
              description: true,
              imageUrl: true,
              value: true,
              valueType: true,
              status: true,
              startDate: true,
              endDate: true,
              merchantRef: true,
              merchantId: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    }

    return customer ? { ...customer, ownedVouchers } : null;
  }

  async getCustomerById(merchantId: string, customerId: string): Promise<any> {
    // First get customer with customerPoints (without transaction relations)
    const customer = await this.repository.findUnique<
      Customer & {
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

    if (!customer) {
      return null;
    }

    // Query sent transactions using senderId (unified field)
    const sentTxns = await this.prisma.transaction.findMany({
      where: {
        senderId: customerId,
        merchantId,
      },
      select: {
        id: true,
        txHash: true,
        createdAt: true,
        transactionTypeId: true,
        senderId: true,
        senderType: true,
        receiverId: true,
        receiverType: true,
        senderAddress: true,
        receiverAddress: true,
        merchant: {
          select: {
            name: true,
            website: true,
          },
        },
        amount: true,
      },
    });

    // Query received transactions using receiverId (unified field)
    const receivedTxns = await this.prisma.transaction.findMany({
      where: {
        receiverId: customerId,
        merchantId,
      },
      select: {
        id: true,
        txHash: true,
        createdAt: true,
        transactionTypeId: true,
        senderId: true,
        senderType: true,
        receiverId: true,
        receiverType: true,
        senderAddress: true,
        receiverAddress: true,
        merchant: {
          select: {
            name: true,
            website: true,
          },
        },
        amount: true,
      },
    });

    return {
      ...customer,
      sentTxns: sentTxns as any,
      receivedTxns: receivedTxns as any,
    };
  }

  async getCustomerByPhoneDetailed(phone: string): Promise<any> {
    const customer = await this.repository.findFirst<any>({
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
      },
    });

    // Query ownedVouchers separately since we removed the relation
    let ownedVouchers: any[] = [];
    if (customer) {
      ownedVouchers = await this.prisma.voucherCode.findMany({
        where: {
          currentOwnerId: customer.id,
          currentOwnerType: 'CUSTOMER',
        },
        include: {
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
      });
    }

    return customer ? { ...customer, ownedVouchers } : customer;
  }

  async getAllCustomers(pageOptionsDto: PageOptionsDto): Promise<{
    customers: (Customer & { wallet?: Wallet | null })[];
    count: number;
  }> {
    const count = await this.repository.count();

    const customers = await this.repository.findMany<Customer>({
      take: pageOptionsDto.take,
      skip: pageOptionsDto.skip,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        tel: true,
        createdAt: true,
        updatedAt: true,
        wallet: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return { customers, count };
  }
}
