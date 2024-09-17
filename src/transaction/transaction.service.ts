import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';
import { TransactionRepository } from './transaction.repository';
import { Prisma, Transaction } from '@prisma/client';

@Injectable()
export class TransactionService {
  constructor(private repository: TransactionRepository) {}

  async getTransactionsByMerchatId(
    merchantId: string,
  ): Promise<{ transactions: Transaction[]; counts: number }> {
    try {
      const transactions = await this.repository.findMany({
        where: {
          merchantId,
        },
      });

      return { transactions, counts: transactions.length };
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
      'merchant' | 'point' | 'transactionType' | 'txHash'
    >,
  ): Promise<Transaction> {
    try {
      const transaction = await this.repository.create({
        data: {
          ...data,
          merchantId,
          pointId,
          txHash,
        },
      });
      return transaction;
    } catch (error) {
      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }
}
