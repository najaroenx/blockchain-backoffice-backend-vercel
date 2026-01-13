import { Injectable } from '@nestjs/common';
import { TransactionRepository } from '../transaction.repository';
import {
  GetTransactionsByCustomerId,
  GetTransactionsByMerchantId,
} from '../types';
import { Prisma, Transaction } from '@prisma/client';
import { startOfDay, endOfDay } from 'date-fns';

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
          point: true,
          voucherCode: {
            select: {
              id: true,
              currency: true, // VoucherCode currency as fallback
              voucher: {
                select: {
                  id: true,
                  tokenId: true,
                  name: true,
                  description: true,
                  valueType: true,
                  value: true,
                  currency: true,
                  imageUrl: true,
                  startDate: true,
                  endDate: true,
                  merchantRef: true,
                },
              },
            },
          },
        },
      });

    return transactions;
  }

  async getAllTransactionsByCustomerId(
    customerId: string,
  ): Promise<GetTransactionsByCustomerId[]> {
    const transactions =
      await this.repository.findMany<GetTransactionsByCustomerId>({
        where: {
          OR: [{ senderId: customerId }, { receiverId: customerId }],
        },
        include: {
          merchant: true,
          point: true,
          voucherCode: {
            select: {
              id: true,
              currency: true, // VoucherCode currency as fallback
              voucher: {
                select: {
                  id: true,
                  tokenId: true,
                  name: true,
                  description: true,
                  valueType: true,
                  value: true,
                  currency: true,
                  imageUrl: true,
                  startDate: true,
                  endDate: true,
                  merchantRef: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
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
          point: true,
          voucherCode: {
            include: {
              voucher: {
                select: {
                  id: true,
                  name: true,
                  valueType: true,
                  value: true,
                  imageUrl: true,
                },
              },
            },
          },
        },
      });

    return transactions;
  }

  async getTransactionsTodayByMerchantId(
    merchantId: string,
  ): Promise<GetTransactionsByMerchantId[]> {
    const transactions =
      await this.repository.findMany<GetTransactionsByMerchantId>({
        where: {
          merchantId,
          createdAt: {
            gte: startOfDay(new Date()),
            lte: endOfDay(new Date()),
          },
        },
      });

    return transactions;
  }

  async getTransactionsMonthByMerchantId(
    merchantId: string,
  ): Promise<GetTransactionsByMerchantId[]> {
    const transactions =
      await this.repository.findMany<GetTransactionsByMerchantId>({
        where: {
          merchantId,
          createdAt: {
            gte: startOfDay(new Date()),
            lte: endOfDay(new Date()),
          },
        },
        include: {
          merchant: true,
          point: true,
        },
      });

    return transactions;
  }

  async getTransactionsTodayByMerchantIdAndTypeId(
    merchantId: string,
    typeId: string,
  ): Promise<GetTransactionsByMerchantId[]> {
    const transactions =
      await this.repository.findMany<GetTransactionsByMerchantId>({
        where: {
          merchantId,
          transactionTypeId: typeId,
          createdAt: {
            gte: startOfDay(new Date()),
            lte: endOfDay(new Date()),
          },
        },
        include: {
          merchant: true,
          point: true,
        },
      });

    return transactions;
  }

  async getTransactionById(id: string): Promise<any> {
    const transaction = await this.repository.findFirst({
      where: { id },
      include: {
        merchant: true,
        point: true,
        voucherCode: {
          include: {
            voucher: {
              select: {
                id: true,
                name: true,
                valueType: true,
                value: true,
                imageUrl: true,
              },
            },
          },
        },
      },
    });

    return transaction;
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
