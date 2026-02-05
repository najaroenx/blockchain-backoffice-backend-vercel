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
        orderBy: {
          createdAt: 'asc',
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
          createdAt: 'asc',
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
        orderBy: {
          createdAt: 'asc',
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

  async getTransactionsByMerchantRef(
    merchantRef: string,
    status?: string,
    couponId?: string,
  ): Promise<any[]> {
    console.log(
      'merchantRef',
      merchantRef,
      'status',
      status,
      'couponId',
      couponId,
    );

    // Build SQL query dynamically
    let sql = `
      SELECT 
        t.*,
        m.id as "merchant_id",
        m.name as "merchant_name",
        m."imageUrl" as "merchant_imageUrl",
        p.id as "point_id",
        p.name as "point_name",
        p.symbol as "point_symbol",
        p."imageUrl" as "point_imageUrl",
        vc.id as "voucherCode_id",
        vc.code as "voucherCode_code",
        vc.currency as "voucherCode_currency",
        v.id as "voucher_id",
        v.name as "voucher_name",
        v."valueType" as "voucher_valueType",
        v.value as "voucher_value",
        v."imageUrl" as "voucher_imageUrl"
      FROM "Transaction" t
      LEFT JOIN "Merchant" m ON t."merchantId" = m.id
      LEFT JOIN "Point" p ON t."pointId" = p.id
      LEFT JOIN "VoucherCode" vc ON t."voucherCodeId" = vc.id
      LEFT JOIN "Voucher" v ON vc."voucherId" = v.id
    `;

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (merchantRef) {
      conditions.push(`v."merchantRef" = $${paramIndex}`);
      params.push(merchantRef);
      paramIndex++;
    }

    if (couponId) {
      conditions.push(`v.id = $${paramIndex}`);
      params.push(couponId);
      paramIndex++;
    }

    if (status) {
      conditions.push(`t."transactionTypeId" = $${paramIndex}`);
      params.push(status.toUpperCase());
      paramIndex++;
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    sql += ` ORDER BY t.created_at DESC`;

    const rawTransactions = await this.repository.queryRaw(sql, params);

    // Transform raw results to match expected format
    const transactions = (rawTransactions as any[]).map((row) => ({
      id: row.id,
      txHash: row.txHash,
      senderAddress: row.senderAddress,
      receiverAddress: row.receiverAddress,
      transactionTypeId: row.transactionTypeId,
      amount: row.amount,
      senderId: row.senderId,
      receiverId: row.receiverId,
      senderType: row.senderType,
      receiverType: row.receiverType,
      merchantId: row.merchantId,
      pointId: row.pointId,
      voucherCodeId: row.voucherCodeId,
      eventId: row.eventId,
      transactionRefId: row.transactionRefId,
      type: row.type,
      merchantRef: row.merchantRef,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      merchant: row.merchant_id
        ? {
            id: row.merchant_id,
            name: row.merchant_name,
            imageUrl: row.merchant_imageUrl,
          }
        : null,
      point: row.point_id
        ? {
            id: row.point_id,
            name: row.point_name,
            symbol: row.point_symbol,
            imageUrl: row.point_imageUrl,
          }
        : null,
      voucherCode: row.voucherCode_id
        ? {
            id: row.voucherCode_id,
            code: row.voucherCode_code,
            currency: row.voucherCode_currency,
            voucher: row.voucher_id
              ? {
                  id: row.voucher_id,
                  name: row.voucher_name,
                  valueType: row.voucher_valueType,
                  value: row.voucher_value,
                  imageUrl: row.voucher_imageUrl,
                }
              : null,
          }
        : null,
    }));

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
