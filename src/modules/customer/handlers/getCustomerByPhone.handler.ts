import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import {
  // CUSTOMER_NOT_FOUND,
  INTERNAL_SERVER_ERROR,
} from 'src/errors/error.constants';
import { CustomerDBService } from '../services/customer-db.service';
import { convertBufferToAddress } from 'src/libs/convertBufferToAddress';
import {
  GetCustomerByEmailResponseType,
  GetCustomerByPhoneResponseNotFoundType,
} from '../types';

@Injectable()
export class GetCustomerPhone {
  private logger = new Logger(GetCustomerPhone.name);

  constructor(private db: CustomerDBService) {}

  async execute(
    merchantId: string,
    phone: string,
  ): Promise<
    GetCustomerByEmailResponseType | GetCustomerByPhoneResponseNotFoundType
  > {
    try {
      const customer = await this.db.getCustomersByPhone(merchantId, phone);

      if (!customer)
        return {
          message: `Customer with phone ${phone} not found`,
          url: 'http://localhost:3000/otp?kid=dsadasdasdasd&cb=profile',
          callbackUrl: 'http://localhost:4001/auth/verify',
        };

      const formattedCustomer = {
        ...customer,
        phone: phone,
        walletAddress: convertBufferToAddress(customer.walletAddress),
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
