import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { CUSTOMER_NOT_FOUND } from 'src/errors/error.constants';
import { CustomerDBService } from '../services/customer-db.service';
import { convertBufferToAddress } from 'src/libs/convertBufferToAddress';
import { GetCustomersIdResponseType } from '../types';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';
import { logAndRethrowOrInternalError } from 'src/common/utils/handler-error.util';

@Injectable()
export class GetCustomerById {
  private readonly logger = new Logger(GetCustomerById.name);

  constructor(
    private readonly db: CustomerDBService,
    private readonly blockchainService: BlockchainService,
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
        senderId: tx.senderId,
        senderType: tx.senderType,
        receiverId: tx.receiverId,
        receiverType: tx.receiverType,
        senderAddress: convertBufferToAddress(tx.senderAddress),
        receiverAddress: convertBufferToAddress(tx.receiverAddress),
        txHash: convertBufferToAddress(tx.txHash),
        amount: tx.amount,
        createdAt: tx.createdAt,
        transactionTypeId: tx.transactionTypeId,
        merchant: tx.merchant,
      }));

      const customerWalletAddress = customer.wallet?.walletAddress || '';

      const formattedCustomerPoint = await Promise.all(
        customer.customerPoints.map(async ({ point }) => ({
          ...point,
          contractAddress: convertBufferToAddress(point.contractAddress),
          balances: await this.getBalanceFromContract(
            convertBufferToAddress(point.contractAddress),
            customerWalletAddress,
          ),
          // balances: await this.getPointBalance(
          //   convertBufferToAddress(point.contractAddress),
          //   customerWalletAddress,
          // ),
        })),
      );

      const formattedCustomer = {
        ...rest,
        walletAddress: customerWalletAddress,
        transactions: formattedTransactions,
        customerPoints: formattedCustomerPoint,
      };

      return {
        customer: formattedCustomer,
      };
    } catch (error) {
      logAndRethrowOrInternalError(this.logger, error, [NotFoundException]);
    }
  }

  private async getBalanceFromContract(
    pointAddress: string,
    walletAddress: string,
  ): Promise<string> {
    // Get balance from blockchain
    const { balance } = await this.blockchainService.getBalance({
      walletAddress,
      pointAddress: pointAddress,
    });
    this.logger.log(`[GetCustomerById] Balance retrieved: ${balance} points`);
    return balance ?? '0';
  }
}
