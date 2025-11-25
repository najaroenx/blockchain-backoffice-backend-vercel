import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';
import { CustomerDBService } from '../services/customer-db.service';
import { Prisma } from '@prisma/client';
import { TokenService } from 'src/providers/token/token.service';
import { ConfigService } from '@nestjs/config';
import { createWallet } from 'src/libs/createWallet';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class CreateCustomer {
  private salt: string;
  private logger = new Logger(CreateCustomer.name);

  constructor(
    private db: CustomerDBService,
    private tokenService: TokenService,
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    this.salt = this.configService.get<string>('SALT');
  }

  async execute(
    merchantId: string,
    data: Omit<
      Prisma.CustomerCreateInput,
      'id' | 'customerMerChant' | 'transaction' | 'wallet'
    >,
  ): Promise<any> {
    try {
      const customer = await this.db.getCustomersByEmail(
        merchantId,
        data.email,
      );
      //TODO: Handle case customer already exists, should not; register more than once
      //TODO:  verify if the customer already associated with the merchant <CAMARA PROJECT>
      //TODO: should change identity with phone number
      if (customer) {
        const isUserAssociatedWithMerchant = customer.customerMerChant.some(
          (el) => el.merchantId === merchantId,
        );

        // make sure customer not register more than once
        if (isUserAssociatedWithMerchant) {
          return {
            ...customer,
            walletAddress: customer.wallet?.walletAddress || '',
          };
        } else {
          await this.db.updateCustomer(customer.id, {
            customerMerChant: { create: { merchantId } },
          });
          // Re-fetch customer with wallet to get walletAddress
          const updatedCustomer = await this.db.getCustomersByEmail(
            merchantId,
            data.email,
          );
          return {
            ...updatedCustomer,
            walletAddress: (updatedCustomer as any).wallet?.walletAddress || '',
          };
        }
      }

      // Use transaction to create wallet and customer atomically
      const result = await this.prisma.$transaction(async (tx) => {
        const { privateKey, walletAddress } = createWallet();

        const encryptedPrivateKey = this.tokenService.encryptKey(
          this.salt,
          privateKey,
        );

        // Create wallet first
        const wallet = await tx.wallet.create({
          data: {
            walletAddress,
            privateKey: encryptedPrivateKey,
            email: data.email,
            phoneNumber: data.tel,
            type: 'customer',
            status: 'active',
          },
        });

        // Create customer with wallet reference
        const newCustomer = await tx.customer.create({
          data: {
            ...data,
            walletId: wallet.id,
            customerMerChant: { create: { merchantId } },
          },
          include: {
            wallet: true,
          },
        });

        return {
          customer: newCustomer,
          walletAddress: wallet.walletAddress,
        };
      });

      return {
        ...result.customer,
        walletAddress: result.walletAddress,
      };
    } catch (error) {
      this.logger.error(
        `Error message : ${error.message}, \n Error detail : ${error}`,
      );
      if (error instanceof NotFoundException) {
        throw error;
      } else {
        throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
      }
    }
  }
}
