jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import { InternalServerErrorException } from '@nestjs/common';
import { DashboardService } from 'src/modules/internal/dashboard/handlers/dashboard.handler';
import { PrismaService } from 'prisma/prisma.service';
import { GetTransactionsByMerchantId } from 'src/modules/internal/transaction/handlers/getTransactionsByMerchantId.handler';

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: any;
  let getTransactionsByMerchantId: any;

  beforeEach(() => {
    prisma = {
      customer: { count: jest.fn() },
      transaction: { findMany: jest.fn(), count: jest.fn() },
    };
    getTransactionsByMerchantId = { execute: jest.fn() };

    service = new DashboardService(
      prisma as unknown as PrismaService,
      getTransactionsByMerchantId as unknown as GetTransactionsByMerchantId,
    );
  });

  it('should return dashboard data with customer count and transactions', async () => {
    prisma.customer.count.mockResolvedValue(42);
    prisma.transaction.findMany.mockResolvedValue([
      { createdAt: new Date('2025-03-15'), transactionTypeId: 'REDEEM' },
      { createdAt: new Date('2025-03-16'), transactionTypeId: 'TRANSFER' },
    ]);
    prisma.transaction.count
      .mockResolvedValueOnce(3) // REDEEM today
      .mockResolvedValueOnce(5) // TRANSFER today
      .mockResolvedValueOnce(8); // all today
    getTransactionsByMerchantId.execute.mockResolvedValue({ transactions: [] });

    const result = await service.execute('m1');

    expect(result.customerWallet).toBe(42);
    expect(result.transactionsToday).toBe(8);
    expect(result.totalRedeem).toBe(3);
    expect(result.totalTransfer).toBe(5);
    expect(result.allTransactions).toEqual({ transactions: [] });
    expect(result.transactionsMonthly).toBeDefined();
  });

  it('should group transactions by month correctly', async () => {
    const now = new Date();
    const year = now.getFullYear();
    prisma.customer.count.mockResolvedValue(0);
    prisma.transaction.findMany.mockResolvedValue([
      { createdAt: new Date(`${year}-01-15`), transactionTypeId: 'REDEEM' },
      { createdAt: new Date(`${year}-01-20`), transactionTypeId: 'REDEEM' },
      { createdAt: new Date(`${year}-02-10`), transactionTypeId: 'TRANSFER' },
    ]);
    prisma.transaction.count.mockResolvedValue(0);
    getTransactionsByMerchantId.execute.mockResolvedValue([]);

    const result = await service.execute('m1');

    // Data should be grouped, check structure
    expect(result.transactionsMonthly).toHaveProperty('months');
    expect(result.transactionsMonthly).toHaveProperty('amountTransactions');
    expect(result.transactionsMonthly.months.length).toBeGreaterThan(0);
  });

  it('should throw InternalServerErrorException on error', async () => {
    prisma.customer.count.mockRejectedValue(new Error('DB fail'));

    await expect(service.execute('m1')).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
