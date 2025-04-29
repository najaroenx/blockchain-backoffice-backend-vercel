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
import { convertBufferToAddress } from 'src/libs/convertBufferToAddress';
import { GetCustomersIdResponseType } from '../types';
import { Kiwari } from '@kiwarilabs/chidori-sdk';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';

@Injectable()
export class GetCustomerById {
  private logger = new Logger(GetCustomerById.name);

  constructor(
    private db: CustomerDBService,
    private blockchainService: BlockchainService,
  ) {}

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

      const formattedCustomerPoint = await Promise.all(
        customer.customerPoints.map(async ({ point }) => ({
          ...point,
          contractAddress: convertBufferToAddress(point.contractAddress),
          balances: await this.getPointBalance(
            convertBufferToAddress(point.contractAddress),
            convertBufferToAddress(customer.walletAddress),
          ),
        })),
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

  private async getPointBalance(
    pointAddress: string,
    walletAddress: string,
  ): Promise<number> {
    const kiwari = new Kiwari({
      provider: this.blockchainService.provider,
    });

    const balances = await kiwari.erc20Expirable.getBalanceOf({
      contractAddress: pointAddress,
      accountAddress: walletAddress,
    });

    console.log(balances);

    return balances;
  }
}
