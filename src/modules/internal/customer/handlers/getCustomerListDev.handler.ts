import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';
import { CustomerDBService } from '../services/customer-db.service';
import { PageOptionsDto } from 'src/common/dtos';

@Injectable()
export class GetCustomerListDev {
  private readonly logger = new Logger(GetCustomerListDev.name);

  constructor(private readonly db: CustomerDBService) {}

  async execute(pageOptionsDto: PageOptionsDto) {
    try {
      const { customers, count } =
        await this.db.getAllCustomers(pageOptionsDto);

      const formattedCustomers = customers.map((customer) => ({
        ...customer,
        walletAddress: customer.wallet?.walletAddress || '',
      }));

      return {
        customers: formattedCustomers,
        count,
        lower: pageOptionsDto.skip,
        upper: Math.min(
          pageOptionsDto.skip + pageOptionsDto.take - 1,
          count - 1,
        ),
      };
    } catch (error) {
      this.logger.error(
        `Error message: ${error.message}, \n Error detail: ${error}`,
      );
      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }
}
