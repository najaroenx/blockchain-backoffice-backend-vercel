import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';
import { CustomerDBService } from '../services/customer-db.service';
import { GetCustomersByMerchantIdResponseType } from '../types';
import { PageOptionsDto } from 'src/common/dtos';

@Injectable()
export class GetCustomersByMerchantId {
  private logger = new Logger(GetCustomersByMerchantId.name);

  constructor(private db: CustomerDBService) {}

  async execute(
    merchantId: string,
    pageOptionsDto: PageOptionsDto,
  ): Promise<
    GetCustomersByMerchantIdResponseType & {
      lower: number;
      upper: number;
    }
  > {
    try {
      const { customers, count } = await this.db.getCustomersByMerchant(
        merchantId,
        pageOptionsDto,
      );

      const formattedCustomer = customers.map((customer) => ({
        ...customer,
        walletAddress: customer.wallet?.walletAddress || '',
      }));

      return {
        customers: formattedCustomer,
        counts: count,
        lower: pageOptionsDto.skip,
        upper: pageOptionsDto.skip + pageOptionsDto.take - 1,
      };
    } catch (error) {
      this.logger.error(
        `Error message : ${error.message}, \n Error detail : ${error}`,
      );
      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }
}
