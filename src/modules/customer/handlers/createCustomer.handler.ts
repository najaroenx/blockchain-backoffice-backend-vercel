import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';
import { CustomerDBService } from '../services/customer-db.service';
import { convertBufferToAddress } from 'src/libs/convertBufferToAddress';
import { Prisma } from '@prisma/client';
import { TokenService } from 'src/providers/token/token.service';
import { ConfigService } from '@nestjs/config';
import { createWallet } from 'src/libs/createWallet';
// import { createBufferFromHex } from 'src/libs/createBufferFromHex';

@Injectable()
export class CreateCustomer {
  private salt: string;
  private logger = new Logger(CreateCustomer.name);

  constructor(
    private db: CustomerDBService,
    private tokenService: TokenService,
    private configService: ConfigService,
  ) {
    this.salt = this.configService.get<string>('SALT');
  }

  async execute(
    merchantId: string,
    data: Omit<
      Prisma.CustomerCreateInput,
      'customerMerChant' | 'transaction' | 'walletAddress' | 'privateKey'
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
            walletAddress: convertBufferToAddress(customer.walletAddress),
          };
        } else {
          const updatedCustomer = await this.db.updateCustomer(customer.id, {
            customerMerChant: { create: { merchantId } },
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

      const newCustomer = await this.db.createCustomer({
        ...data,
        walletAddress: Buffer.from(
          wallet.walletAddress.replace(/^0x/, ''),
          'hex',
        ),
        privateKey: encryptedPrivateKey,
        customerMerChant: { create: { merchantId } },
      });
      return {
        ...newCustomer,
        walletAddress: convertBufferToAddress(newCustomer.walletAddress),
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
