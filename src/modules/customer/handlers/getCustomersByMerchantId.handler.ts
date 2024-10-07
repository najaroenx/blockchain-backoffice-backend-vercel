import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';
import { CustomerDBService } from '../services/customer-db.service';
import { GetCustomersByMerchantIdResponseType } from '../types';
import { convertBufferToAddress } from 'src/libs/convertBufferToAddress';

@Injectable()
export class GetCustomersByMerchantId {
  constructor(private db: CustomerDBService) {}

  async execute(
    merchantId: string,
  ): Promise<GetCustomersByMerchantIdResponseType> {
    try {
      const customers = await this.db.getCustomersByMerchant(merchantId);

      const formattedCustomer = customers.map((customer) => ({
        ...customer,
        walletAddress: convertBufferToAddress(customer.walletAddress),
      }));

      return {
        customers: formattedCustomer,
        counts: formattedCustomer.length,
      };
    } catch (error) {
      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }
}
