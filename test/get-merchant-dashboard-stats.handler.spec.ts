jest.mock('prisma/prisma.service', () => ({ PrismaService: jest.fn() }));

import {
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { GetMerchantDashboardStats } from 'src/modules/internal/merchant/handlers/getMerchantDashboardStats.handler';

describe('GetMerchantDashboardStats', () => {
  let handler: GetMerchantDashboardStats;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      merchant: { findUnique: jest.fn() },
      voucher: { findMany: jest.fn() },
      voucherCode: { findMany: jest.fn() },
      customerMerChant: { count: jest.fn() },
      point: { findMany: jest.fn(), findFirst: jest.fn() },
      transaction: { aggregate: jest.fn() },
    };
    handler = new GetMerchantDashboardStats(prisma as any);
  });

  it('throws NotFoundException if merchant not found', async () => {
    prisma.merchant.findUnique.mockResolvedValue(null);
    await expect(handler.execute('m1')).rejects.toThrow(NotFoundException);
  });

  it('returns full dashboard stats for merchant with data', async () => {
    prisma.merchant.findUnique.mockResolvedValue({ id: 'm1', name: 'Shop' });

    // Voucher stats
    prisma.voucher.findMany
      .mockResolvedValueOnce([{ id: 'v1' }, { id: 'v2' }]) // getVoucherStats
      .mockResolvedValueOnce([{ id: 'v1' }]); // getEndUserStats

    prisma.voucherCode.findMany
      .mockResolvedValueOnce([
        {
          id: 'vc1',
          pointsCost: 100,
          currentOwnerId: 'c1',
          currentOwnerType: 'CUSTOMER',
          isUsed: false,
        },
        {
          id: 'vc2',
          pointsCost: 200,
          currentOwnerId: 'c1',
          currentOwnerType: 'CUSTOMER',
          isUsed: true,
        },
        {
          id: 'vc3',
          pointsCost: 150,
          currentOwnerId: 'm1',
          currentOwnerType: 'MERCHANT',
          isUsed: false,
        },
      ])
      .mockResolvedValueOnce([
        {
          currentOwnerId: 'c1',
          currentOwnerType: 'CUSTOMER',
          isUsed: false,
        },
        {
          currentOwnerId: 'c1',
          currentOwnerType: 'CUSTOMER',
          isUsed: true,
        },
      ]);

    // End user stats
    prisma.customerMerChant.count.mockResolvedValue(5);

    // Transaction stats - merchantPoints
    prisma.point.findMany.mockResolvedValue([
      {
        id: 'p1',
        name: 'Gold',
        symbol: 'GLD',
        initialSupply: 1000,
        contractAddress: Buffer.from('aa'.repeat(20), 'hex'),
      },
    ]);

    // Use mockImplementation to handle concurrent calls from Promise.all
    prisma.transaction.aggregate.mockImplementation((args: any) => {
      if (args.where.transactionTypeId === 'TRANSFER') {
        return Promise.resolve({ _count: { id: 3 }, _sum: { amount: 300 } });
      }
      if (args.where.transactionTypeId === 'REDEEM') {
        return Promise.resolve({ _count: { id: 1 }, _sum: { amount: 50 } });
      }
      if (args.where.transactionTypeId === 'THB_MINT') {
        return Promise.resolve({ _sum: { amount: 500 } });
      }
      if (args.where.transactionTypeId === 'THB_BUY') {
        return Promise.resolve({ _sum: { amount: 200 } });
      }
      return Promise.resolve({ _count: { id: 0 }, _sum: { amount: 0 } });
    });

    // AIS point
    prisma.point.findFirst.mockResolvedValue({
      id: 'ais1',
      name: 'AIS Point',
      symbol: 'AIS',
    });

    const result = await handler.execute('m1');

    expect(result.vouchers.total).toBe(3);
    expect(result.vouchers.sold).toBe(2);
    expect(result.vouchers.soldButNotUsed).toBe(1);
    expect(result.vouchers.redeemed).toBe(1);
    expect(result.vouchers.sold).toBe(
      result.vouchers.soldButNotUsed + result.vouchers.redeemed,
    );
    expect(result.voucherValue.total).toBe(450);
    expect(result.endUsers.total).toBe(5);
    expect(result.transactions.merchantPointTransfers).toHaveLength(1);
    expect(result.transactions.merchantPointTransfers[0].totalTransfers).toBe(
      3,
    );
    expect(result.points.list).toHaveLength(1);
    expect(result.points.totalCirculation).toBe(1000);
    expect(result.thbToken.deposited).toBe(500);
    expect(result.thbToken.purchasedFromSeller).toBe(200);
  });

  it('returns zero stats when no vouchers exist', async () => {
    prisma.merchant.findUnique.mockResolvedValue({ id: 'm1', name: 'Shop' });
    prisma.voucher.findMany
      .mockResolvedValueOnce([]) // getVoucherStats
      .mockResolvedValueOnce([]); // getEndUserStats
    prisma.voucherCode.findMany.mockResolvedValue([]);
    prisma.customerMerChant.count.mockResolvedValue(0);
    prisma.point.findMany.mockResolvedValue([]);
    prisma.point.findFirst.mockResolvedValue(null);
    prisma.transaction.aggregate.mockResolvedValue({
      _sum: { amount: null },
      _count: { id: 0 },
    });

    const result = await handler.execute('m1');
    expect(result.vouchers.total).toBe(0);
    expect(result.transactions.aisPointRedeems.pointId).toBeNull();
  });

  it('wraps generic errors in InternalServerErrorException', async () => {
    prisma.merchant.findUnique.mockRejectedValue(new Error('DB error'));
    await expect(handler.execute('m1')).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
