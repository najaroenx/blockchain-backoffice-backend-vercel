import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';
import { CustomerDBService } from '../services/customer-db.service';
import { GetAllCustomersByMerchantWithWalletResponseType } from '../types';

@Injectable()
export class GetAllCustomersByMerchantWithWallet {
  private readonly logger = new Logger(
    GetAllCustomersByMerchantWithWallet.name,
  );

  constructor(private readonly db: CustomerDBService) {}

  async execute(
    merchantId: string,
  ): Promise<GetAllCustomersByMerchantWithWalletResponseType> {
    try {
      const { customers, count } =
        await this.db.getAllCustomersByMerchantWithWallet(merchantId);

      return {
        customers,
        counts: count,
      };
    } catch (error) {
      this.logger.error(
        `Error message : ${error.message}, \n Error detail : ${error}`,
      );
      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }
}
