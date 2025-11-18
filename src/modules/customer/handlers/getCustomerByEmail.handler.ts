import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import {
  CUSTOMER_NOT_FOUND,
  INTERNAL_SERVER_ERROR,
} from 'src/errors/error.constants';
import { CustomerDBService } from '../services/customer-db.service';
import { GetCustomerByEmailResponseType } from '../types';

@Injectable()
export class GetCustomerByEmail {
  private logger = new Logger(GetCustomerByEmail.name);

  constructor(private db: CustomerDBService) {}

  async execute(
    merchantId: string,
    email: string,
  ): Promise<GetCustomerByEmailResponseType> {
    try {
      const customer = await this.db.getCustomersByEmail(merchantId, email);

      if (!customer) throw new NotFoundException(CUSTOMER_NOT_FOUND);

      const formattedCustomer = {
        ...customer,
        walletAddress: customer.wallet?.walletAddress || '',
      };

      return {
        customer: formattedCustomer,
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
