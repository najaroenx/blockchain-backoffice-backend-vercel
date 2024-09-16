import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';
import { TransactionRepository } from './transaction.repository';
import { Transaction } from '@prisma/client';

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

  async createTransacetion({
    txHash,
    amount,
    transactionTypeId,
    receiverAddress,
    email,
    pointId,
    merchantId,
  }: {
    txHash: string;
    amount: number;
    transactionTypeId: string;
    receiverAddress: string;
    email: string;
    pointId: string;
    merchantId: string;
  }): Promise<Transaction> {
    try {
      const transaction = await this.repository.create({
        data: {
          txHash,
          amount,
          email,
          pointId,
          merchantId,
          receiverAddress,
          transactionTypeId,
        },
      });
      return transaction;
    } catch (error) {
      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }
}
