import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  CUSTOMER_NOT_FOUND,
  INTERNAL_SERVER_ERROR,
} from 'src/errors/error.constants';
import { CustomerDBService } from '../services/customer-db.service';
import { convertBufferToAddress } from 'src/libs/convertBufferToAddress';
import { GetCustomersIdResponseType } from '../types';

@Injectable()
export class GetCustomerById {
  constructor(private db: CustomerDBService) {}

  async execute(
    merchantId: string,
    customerId: string,
  ): Promise<GetCustomersIdResponseType> {
    try {
      const customer = await this.db.getCustomerById(merchantId, customerId);

      if (!customer) throw new NotFoundException(CUSTOMER_NOT_FOUND);

      const { receivedTxns, sentTxns, ...rest } = customer;

      const mergeTransaction = [...receivedTxns, ...sentTxns];

      const formattedTransactions = mergeTransaction.map((tx) => ({
        id: tx.id,
        sender: tx.sender?.email ?? tx.merchant.website,
        receiver: tx.receiver.email,
        txHash: convertBufferToAddress(tx.txHash),
        amount: tx.amount,
        createdAt: tx.createdAt,
        transactionTypeId: tx.transactionTypeId,
      }));

      const formattedCustomerPoint = customer.customerPoints.map(
        ({ point, balances }) => ({
          ...point,
          contractAddress: convertBufferToAddress(point.contractAddress),
          balances,
        }),
      );

      const formattedCustomer = {
        ...rest,
        walletAddress: convertBufferToAddress(customer.walletAddress),
        transactions: formattedTransactions,
        customerPoints: formattedCustomerPoint,
      };

      return {
        customer: formattedCustomer,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      } else {
        throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
      }
    }
  }
}
