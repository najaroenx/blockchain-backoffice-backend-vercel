import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';
import { TransactionRepository } from './transaction.repository';
import { Prisma, Transaction } from '@prisma/client';
import { createBufferFromHex } from 'src/libs/createBufferFromHex';
import { convertBufferToAddress } from 'src/libs/convertBufferToAddress';

@Injectable()
export class TransactionService {
  constructor(private repository: TransactionRepository) {}

  async getTransactionsByMerchatId(merchantId: string): Promise<{
    transactions: Array<
      Omit<Transaction, 'txHash' | 'receiverAddress'> & {
        txHash: string;
        receiverAddress: string;
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
        receiverAddress: convertBufferToAddress(transaction.receiverAddress),
      }));

      return { transactions: cleanTransactions, counts: transactions.length };
    } catch (error) {
      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }

  async createTransacetion(
    merchantId: string,
    pointId: string,
    txHash: string,
    data: Omit<
      Prisma.TransactionCreateInput,
      'merchant' | 'point' | 'transactionType' | 'txHash' | 'customer'
    >,
  ): Promise<Transaction> {
    try {
      const txHashBuffer = createBufferFromHex(txHash);

      const transaction: Transaction = await this.repository.create({
        data: {
          ...data,
          merchantId,
          pointId,
          txHash: txHashBuffer,
        },
      });
      return transaction;
    } catch (error) {
      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }
}
