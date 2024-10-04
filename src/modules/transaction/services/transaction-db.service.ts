import { Injectable } from '@nestjs/common';
import { TransactionRepository } from '../transaction.repository';
import {
  GetTransactionsByCustomerId,
  GetTransactionsByMerchantId,
} from '../types';
import { Prisma, Transaction } from '@prisma/client';

@Injectable()
export class TransactionDBService {
  constructor(private readonly repository: TransactionRepository) {}

  async getTransactionsByCustomerId(
    customerId: string,
    merchantId: string,
  ): Promise<GetTransactionsByCustomerId[]> {
    const transactions =
      await this.repository.findMany<GetTransactionsByCustomerId>({
        where: {
          OR: [{ senderId: customerId }, { receiverId: customerId }],
          merchantId,
        },
        include: {
          merchant: true,
          sender: true,
          receiver: true,
          point: true,
        },
      });

    return transactions;
  }

  async getTransactionsByMerchantId(
    merchantId: string,
  ): Promise<GetTransactionsByMerchantId[]> {
    const transactions =
      await this.repository.findMany<GetTransactionsByMerchantId>({
        where: {
          merchantId,
        },
        include: {
          merchant: true,
          sender: true,
          receiver: true,
          point: true,
        },
      });

    return transactions;
  }

  async createTransaction(
    data: Prisma.TransactionCreateInput,
  ): Promise<Transaction> {
    const transaction = await this.repository.create<Transaction>({
      data,
    });
    return transaction;
  }
}
