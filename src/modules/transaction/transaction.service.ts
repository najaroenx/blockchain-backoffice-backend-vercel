import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';
import { TransactionRepository } from './transaction.repository';
import { Prisma, Transaction } from '@prisma/client';
import { createBufferFromHex } from 'src/libs/createBufferFromHex';
import { convertBufferToAddress } from 'src/libs/convertBufferToAddress';
import { PointService } from 'src/modules/point/point.service';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';
import { CustomerService } from 'src/modules/customer/customer.service';

@Injectable()
export class TransactionService {
  constructor(
    private repository: TransactionRepository,
    private pointService: PointService,
    private blockchainService: BlockchainService,
    private customerService: CustomerService,
  ) {}

  async getTransactionsByMerchatId(merchantId: string): Promise<{
    transactions: Array<
      Omit<Transaction, 'txHash' | 'receiverAddress' | 'senderAddress'> & {
        txHash: string;
        receiverAddress: string;
        senderAddress: string;
      }
    >;
    counts: number;
  }> {
    try {
      const transactions: Transaction[] = await this.repository.findMany({
        where: {
          merchantId,
        },
      });

      const cleanTransactions = transactions.map((transaction) => ({
        ...transaction,
        txHash: convertBufferToAddress(transaction.txHash),
        senderAddress: convertBufferToAddress(transaction.senderAddress),
        receiverAddress: convertBufferToAddress(transaction.receiverAddress),
      }));

      return { transactions: cleanTransactions, counts: transactions.length };
    } catch (error) {
      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }

  async getTransactionsByCustomerId(
    customerId: string,
    merchantId: string,
  ): Promise<{
    transactions: Array<
      Omit<Transaction, 'txHash' | 'receiverAddress' | 'senderAddress'> & {
        txHash: string;
        receiverAddress: string;
        senderAddress: string;
      }
    >;
    counts: number;
  }> {
    try {
      const transactions: Transaction[] = await this.repository.findMany({
        where: {
          customerId,
          merchantId,
        },
      });

      const cleanTransactions = transactions.map((transaction) => ({
        ...transaction,
        txHash: convertBufferToAddress(transaction.txHash),
        senderAddress: convertBufferToAddress(transaction.senderAddress),
        receiverAddress: convertBufferToAddress(transaction.receiverAddress),
      }));

      return { transactions: cleanTransactions, counts: transactions.length };
    } catch (error) {
      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }

  async createTransaction(
    merchantId: string,
    pointId: string,
    data: Omit<
      Prisma.TransactionCreateInput,
      'merchant' | 'point' | 'transactionType' | 'txHash' | 'customer'
    >,
  ): Promise<
    | Transaction
    | { txHash: string; senderAddress: string; receiverAddress: string }
  > {
    try {
      const { point } = await this.pointService.getPointById(pointId);

      const { customer } = await this.customerService.getCustomerByAddress(
        merchantId,
        data.receiverAddress,
      );

      const { txId } = await this.blockchainService.transaction({
        amount: data.amount,
        to: convertBufferToAddress(data.receiverAddress),
        pointAddress: point.contractAddress,
      });

      const transaction: Transaction = await this.repository.create({
        data: {
          ...data,
          merchantId,
          pointId: point.id,
          txHash: createBufferFromHex(txId),
          customerId: customer.id,
        },
      });

      if (customer.customerPoints.length === 0) {
        await this.customerService.updateCustomer(customer.id, {
          customerPoints: {
            create: {
              pointId: point.id,
              balances: data.amount,
            },
          },
        });
      }

      if (customer.customerPoints.length > 0) {
        const customerPoint = customer.customerPoints.find(
          (cp) => cp.pointId === point.id,
        );

        await this.customerService.updateCustomer(customer.id, {
          customerPoints: {
            update: {
              where: {
                id: customerPoint.id,
              },
              data: {
                balances: customerPoint.balances + data.amount,
              },
            },
          },
        });
      }

      return {
        ...transaction,
        txHash: convertBufferToAddress(transaction.txHash),
        senderAddress: convertBufferToAddress(transaction.senderAddress),
        receiverAddress: convertBufferToAddress(transaction.receiverAddress),
      };
    } catch (error) {
      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }
}
