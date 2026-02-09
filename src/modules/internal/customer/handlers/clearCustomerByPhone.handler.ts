import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CUSTOMER_NOT_FOUND,
  INTERNAL_SERVER_ERROR,
} from 'src/errors/error.constants';
import { CustomerDBService } from '../services/customer-db.service';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class ClearCustomerByPhone {
  private logger = new Logger(ClearCustomerByPhone.name);

  constructor(
    private db: CustomerDBService,
    private prisma: PrismaService,
  ) {}

  async execute(phone: string): Promise<any> {
    try {
      this.logger.log(`[START] Clearing customer with phone: ${phone}`);

      // 1. Find customer by phone with wallet details
      const customer = await this.db.getCustomerByPhoneDetailed(phone);

      if (!customer) {
        this.logger.error(`[ERROR] Customer with phone ${phone} not found`);
        throw new NotFoundException(CUSTOMER_NOT_FOUND);
      }

      this.logger.log(
        `[STEP 1] Found customer: ${customer.id}, wallet: ${customer.walletId || 'none'}`,
      );

      // 2. Use transaction to ensure atomicity
      const result = await this.prisma.$transaction(async (tx) => {
        // 4. Delete customer (cascades to: CustomerMerChant, CustomerPoint, Transactions)
        this.logger.log(`[STEP 3] Deleting customer: ${customer.id}`);
        const deletedCustomer = await tx.customer.delete({
          where: { id: customer.id },
        });

        // 5. Delete wallet if exists
        if (customer.walletId) {
          this.logger.log(`[STEP 4] Deleting wallet: ${customer.walletId}`);
          await tx.wallet.delete({
            where: { id: customer.walletId },
          });
        }

        // 6. Delete temp links by phone
        this.logger.log(`[STEP 5] Deleting temp links for phone: ${phone}`);
        await tx.tempLinkCreateUser.deleteMany({
          where: { phoneNumber: phone },
        });

        return deletedCustomer;
      });

      this.logger.log(
        `[SUCCESS] Cleared customer ${customer.id} and all associated data`,
      );

      return {
        success: true,
        message: 'Customer cleared successfully',
        phone: phone,
        customerId: result.id,
      };
    } catch (error) {
      this.logger.error(
        `[FATAL ERROR] Failed to clear customer: ${error.message}`,
        error.stack,
      );

      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }
}
