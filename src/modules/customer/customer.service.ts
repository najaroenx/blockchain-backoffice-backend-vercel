import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CustomerRepository } from './customer.repository';
import {
  Customer,
  CustomerMerChant,
  Prisma,
  Transaction,
} from '@prisma/client';
import {
  INTERNAL_SERVER_ERROR,
  CUSTOMER_NOT_FOUND,
} from 'src/errors/error.constants';
import { ConfigService } from '@nestjs/config';
import { TokenService } from 'src/providers/token/token.service';
import { createBufferFromHex } from 'src/libs/createBufferFromHex';
import { convertBufferToAddress } from 'src/libs/convertBufferToAddress';
import { createWallet } from 'src/libs/createWallet';

@Injectable()
export class CustomerService {
  private salt: string;

  constructor(
    private repository: CustomerRepository,
    private configService: ConfigService,
    private tokenService: TokenService,
  ) {
    this.salt = this.configService.get<string>('SALT');
  }

  async createCustomer(
    merchantId: string,
    data: Omit<
      Prisma.CustomerCreateInput,
      'customerMerChant' | 'transaction' | 'walletAddress' | 'privateKey'
    >,
  ): Promise<Omit<Customer, 'privateKey'> | { walletAddress: string }> {
    try {
      const customer: Customer & { customerMerChant: CustomerMerChant[] } =
        await this.repository.findFirst({
          where: {
            email: data.email,
          },
          select: {
            id: true,
            walletAddress: true,
            email: true,
            firstName: true,
            lastName: true,
            tel: true,
            customerMerChant: {
              select: {
                id: true,
                merchantId: true,
                customerId: true,
              },
            },
          },
        });

      if (customer) {
        const isUserAssociatedWithMerchant = customer.customerMerChant.some(
          (el) => el.merchantId === merchantId,
        );

        // make sure customer not register more than once
        if (isUserAssociatedWithMerchant) {
          return {
            ...customer,
            walletAddress: convertBufferToAddress(customer.walletAddress),
          };
        } else {
          const updatedCustomer = await this.repository.update({
            where: {
              id: customer.id,
            },
            data: {
              customerMerChant: {
                create: {
                  merchantId,
                },
              },
            },
            select: {
              id: true,
              walletAddress: true,
              email: true,
              firstName: true,
              lastName: true,
              tel: true,
              customerMerChant: {
                select: {
                  id: true,
                  merchantId: true,
                  customerId: true,
                },
              },
            },
          });
          return {
            ...updatedCustomer,
            walletAddress: convertBufferToAddress(
              updatedCustomer.walletAddress,
            ),
          };
        }
      }

      const wallet = createWallet();

      const encryptedPrivateKey = this.tokenService.encryptKey(
        this.salt,
        wallet.privateKey,
      );

      const newCustomer: Customer = await this.repository.create({
        data: {
          ...data,
          walletAddress: createBufferFromHex(wallet.walletAddress),
          privateKey: encryptedPrivateKey,
          customerMerChant: {
            create: {
              merchantId,
            },
          },
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

      return {
        ...newCustomer,
        walletAddress: convertBufferToAddress(newCustomer.walletAddress),
      };
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }

  async getCustomersByMerchant(merchantId: string): Promise<{
    customers: Array<Customer | { walletAddress: string }>;
    counts: number;
  }> {
    try {
      const customers: Customer[] = await this.repository.findMany({
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

      if (!customers) throw new NotFoundException(CUSTOMER_NOT_FOUND);

      const formattedCustomer = customers.map((customer) => ({
        ...customer,
        walletAddress: convertBufferToAddress(customer.walletAddress),
      }));

      return {
        customers: formattedCustomer,
        counts: formattedCustomer.length,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      } else {
        throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
      }
    }
  }

  async getCustomerById(
    customerId: string,
    merchantId: string,
  ): Promise<{
    customer: Omit<Customer, 'walletAddress'>;
  }> {
    try {
      const customer: Customer & { transactions: Transaction[] } =
        await this.repository.findUnique({
          where: { id: customerId },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            walletAddress: true,
            transactions: {
              where: {
                merchantId,
              },
            },
          },
        });

      if (!customer) throw new NotFoundException(CUSTOMER_NOT_FOUND);

      const formattedTransactions = customer.transactions.map((tx) => ({
        ...tx,
        receiverAddress: convertBufferToAddress(tx.receiverAddress),
        senderAddress: convertBufferToAddress(tx.senderAddress),
        txHash: convertBufferToAddress(tx.txHash),
      }));

      const formattedCustomer = {
        ...customer,
        walletAddress: convertBufferToAddress(customer.walletAddress),
        transactions: formattedTransactions,
      };

      return {
        customer: formattedCustomer,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      } else {
        throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
      }
    }
  }

  async getCustomerByAddress(walletAddress: Buffer): Promise<{
    customer: Omit<Customer, 'walletAddress'>;
  }> {
    try {
      const customer: Customer = await this.repository.findFirst({
        where: { walletAddress },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          walletAddress: true,
          transactions: true,
        },
      });

      if (!customer) throw new NotFoundException(CUSTOMER_NOT_FOUND);

      const formattedCustomer = {
        ...customer,
        walletAddress: convertBufferToAddress(customer.walletAddress),
      };

      return {
        customer: formattedCustomer,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      } else {
        throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
      }
    }
  }
}
