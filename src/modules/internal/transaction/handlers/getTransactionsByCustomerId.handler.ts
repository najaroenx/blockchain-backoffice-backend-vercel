import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { TransactionDBService } from '../services/transaction-db.service';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';
import { GetTransactionsByCustomerIdResponseType } from '../types';
import { GetCustomerPhone } from 'src/modules/internal/customer/handlers/getCustomerByPhone.handler';
import {
  formatTransactionDetail,
  sortTransactionDetails,
} from '../utils/transaction-response.util';

@Injectable()
export class GetTransactionsByCustomerId {
  private readonly logger = new Logger(GetTransactionsByCustomerId.name);

  constructor(
    private readonly db: TransactionDBService,
    private readonly getCustomerByPhone: GetCustomerPhone,
  ) {}

  async execute(
    merchantId: string,
    phone: string,
  ): Promise<GetTransactionsByCustomerIdResponseType> {
    try {
      // Lookup customer by phone number
      const customerResponse = await this.getCustomerByPhone.execute(
        merchantId,
        phone,
      );

      // Check if customer was found
      if ('message' in customerResponse) {
        throw new NotFoundException(
          `Customer with phone ${phone} not found or not registered with this merchant`,
        );
      }

      const { customer } = customerResponse;

      // Get transactions using customer ID
      const transactions = await this.db.getTransactionsByCustomerId(
        customer.id,
        merchantId,
      );

      const sortedRes = sortTransactionDetails(
        transactions.map((transaction) =>
          formatTransactionDetail(transaction, {
            perspectiveId: customer.id,
            fallbackParticipantId: merchantId,
            senderDisplayName: transaction.merchant?.name || '',
            receiverDisplayName: transaction.merchant?.name || '',
          }),
        ),
      );

      return {
        transactions: sortedRes,
        counts: sortedRes.length,
      };
    } catch (error) {
      this.logger.error(
        `Error message : ${error.message}, \n Error detail : ${error}`,
      );
      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }

  async executeByCustomerId(
    merchantId: string,
    customerId: string,
  ): Promise<GetTransactionsByCustomerIdResponseType> {
    try {
      // Get transactions using customer ID directly
      const transactions = await this.db.getTransactionsByCustomerId(
        customerId,
        merchantId,
      );

      const sortedRes = sortTransactionDetails(
        transactions.map((transaction) =>
          formatTransactionDetail(transaction, {
            perspectiveId: customerId,
            fallbackParticipantId: merchantId,
            senderDisplayName: transaction.merchant?.name || '',
            receiverDisplayName: transaction.merchant?.name || '',
          }),
        ),
      );

      return {
        transactions: sortedRes,
        counts: sortedRes.length,
      };
    } catch (error) {
      this.logger.error(
        `Error message : ${error.message}, \n Error detail : ${error}`,
      );
      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }
}
