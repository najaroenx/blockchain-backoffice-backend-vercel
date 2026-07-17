jest.mock('prisma/prisma.service', () => ({ PrismaService: jest.fn() }));

import { InternalServerErrorException } from '@nestjs/common';
import { GetMerchantRefDashboardHandler } from 'src/modules/internal/dashboard/handlers/get-merchantref-dashboard.handler';

describe('GetMerchantRefDashboardHandler', () => {
  let handler: GetMerchantRefDashboardHandler;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      $queryRaw: jest.fn(),
      voucher: { findMany: jest.fn() },
      merchantRefStore: { findMany: jest.fn() },
    };
    handler = new GetMerchantRefDashboardHandler(prisma);
  });

  it('returns dashboard with coupon and end user summary', async () => {
    prisma.$queryRaw.mockResolvedValue([
      {
        total: BigInt(10),
        sold: BigInt(6),
        unsold: BigInt(4),
        totalUsers: BigInt(3),
        unredeemedUsers: BigInt(2),
        redeemedUsers: BigInt(1),
      },
    ]);

    const result = await handler.execute('ref1', {});
    expect(result.merchantRef).toBe('ref1');
    expect(result.myMerchantSummary.coupon.total).toBe(10);
    expect(result.myMerchantSummary.coupon.sold).toBe(6);
    expect(result.myMerchantSummary.coupon.unsold).toBe(4);
    expect(result.myMerchantSummary.endUser.total).toBe(3);
    expect(result.dateRange).toHaveProperty('startDate');
    expect(result.dateRange).toHaveProperty('endDate');
  });

  it('returns zero values when no data', async () => {
    prisma.$queryRaw.mockResolvedValue([
      {
        total: BigInt(0),
        sold: BigInt(0),
        unsold: BigInt(0),
        totalUsers: BigInt(0),
        unredeemedUsers: BigInt(0),
        redeemedUsers: BigInt(0),
      },
    ]);

    const result = await handler.execute('ref1', {});
    expect(result.myMerchantSummary.coupon.total).toBe(0);
  });

  it('uses custom date range from query', async () => {
    prisma.$queryRaw.mockResolvedValue([
      {
        total: BigInt(0),
        sold: BigInt(0),
        unsold: BigInt(0),
        totalUsers: BigInt(0),
        unredeemedUsers: BigInt(0),
        redeemedUsers: BigInt(0),
      },
    ]);

    const result = await handler.execute('ref1', {
      startDate: '2024-01-01',
      endDate: '2024-12-31',
    });
    expect(result.dateRange.startDate).toBe('2024-01-01');
    expect(result.dateRange.endDate).toBe('2024-12-31');
  });

  it('wraps errors in InternalServerErrorException', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('DB error'));
    await expect(handler.execute('ref1', {})).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  describe('getCouponDropdown', () => {
    it('returns vouchers for merchantRef', async () => {
      prisma.voucher.findMany.mockResolvedValue([
        { id: 'v1', name: 'Voucher A', merchantRef: 'ref1' },
        { id: 'v2', name: 'Voucher B', merchantRef: 'ref1' },
      ]);
      prisma.merchantRefStore.findMany.mockResolvedValue([
        { merchantRef: 'ref1', name: 'Store Ref 1' },
      ]);

      const result = await handler.getCouponDropdown('ref1');
      expect(result.coupons).toEqual([
        {
          id: 'v1',
          name: 'Voucher A',
          merchantRef: 'ref1',
          merchantRefName: 'Store Ref 1',
        },
        {
          id: 'v2',
          name: 'Voucher B',
          merchantRef: 'ref1',
          merchantRefName: 'Store Ref 1',
        },
      ]);
      expect(prisma.voucher.findMany).toHaveBeenCalledWith({
        where: { merchantRef: 'ref1' },
        select: { id: true, name: true, merchantRef: true },
        orderBy: { name: 'asc' },
      });
    });
  });
});
