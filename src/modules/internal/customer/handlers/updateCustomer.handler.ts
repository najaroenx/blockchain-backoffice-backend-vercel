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
import { Customer, Prisma } from '@prisma/client';

@Injectable()
export class UpdateCustomer {
  private logger = new Logger(UpdateCustomer.name);

  constructor(private db: CustomerDBService) {}

  async execute(
    customerId: string,
    data: Prisma.CustomerUpdateInput,
  ): Promise<Customer> {
    try {
      const customer = await this.db.updateCustomer(customerId, data);

      return customer;
    } catch (error) {
      this.logger.error(
        `Error message : ${error.message}, \n Error detail : ${error}`,
      );
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundException(CUSTOMER_NOT_FOUND);
        }
      } else {
        throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
      }
    }
  }
}
