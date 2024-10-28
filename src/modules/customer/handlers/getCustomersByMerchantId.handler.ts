import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';
import { CustomerDBService } from '../services/customer-db.service';
import { GetCustomersByMerchantIdResponseType } from '../types';
import { convertBufferToAddress } from 'src/libs/convertBufferToAddress';
import { PageOptionsDto } from 'src/common/dtos';

@Injectable()
export class GetCustomersByMerchantId {
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
        walletAddress: convertBufferToAddress(customer.walletAddress),
      }));

      return {
        customers: formattedCustomer,
        counts: count,
        lower: pageOptionsDto.skip,
        upper: pageOptionsDto.skip + pageOptionsDto.take - 1,
      };
    } catch (error) {
      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }
}
