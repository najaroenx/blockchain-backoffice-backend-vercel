jest.mock('prisma/prisma.service', () => ({ PrismaService: jest.fn() }));

import { GetSellerVouchers } from 'src/modules/internal/voucher/handlers/getSellerVouchers.handler';

describe('GetSellerVouchers', () => {
  let handler: GetSellerVouchers;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      voucher: { findMany: jest.fn() },
      $queryRaw: jest.fn(),
    };
    handler = new GetSellerVouchers(prisma as any);
  });

  it('returns seller vouchers with stats for specific merchant', async () => {
    prisma.voucher.findMany.mockResolvedValue([
      {
        id: 'v1',
        totalIssued: 100,
        voucherCodes: [{ pointsCost: 50, pointId: 'p1', currency: 'THB' }],
      },
    ]);
    prisma.$queryRaw.mockResolvedValue([
      {
        voucherId: 'v1',
        totalCodes: BigInt(100),
        listedCodes: BigInt(30),
        soldCodes: BigInt(20),
      },
    ]);

    const result = await handler.execute('m1');
    expect(prisma.voucher.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { merchantId: null, sellerMerchantId: 'm1' },
      }),
    );
    expect(result.vouchers[0].stats.availableForSale).toBe(50); // 100 - 30 - 20
    expect(result.vouchers[0].pointsCost).toBe(50);
    expect(result.vouchers[0].status.isListed).toBe(true);
    expect(result.vouchers[0].status.hasSales).toBe(true);
  });

  it('returns all seller vouchers when no merchantId', async () => {
    prisma.voucher.findMany.mockResolvedValue([]);
    prisma.$queryRaw.mockResolvedValue([]);

    const result = await handler.execute(undefined);
    expect(prisma.voucher.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { merchantId: null },
      }),
    );
    expect(result.count).toBe(0);
    expect(result.vouchers).toEqual([]);
  });

  it('filters out vouchers with zero available stock', async () => {
    prisma.voucher.findMany.mockResolvedValue([
      { id: 'v1', totalIssued: 100, voucherCodes: [] },
      { id: 'v2', totalIssued: 50, voucherCodes: [] },
    ]);
    prisma.$queryRaw.mockResolvedValue([
      {
        voucherId: 'v1',
        totalCodes: BigInt(100),
        listedCodes: BigInt(80),
        soldCodes: BigInt(20),
      },
      {
        voucherId: 'v2',
        totalCodes: BigInt(50),
        listedCodes: BigInt(10),
        soldCodes: BigInt(5),
      },
    ]);

    const result = await handler.execute('m1');
    // v1: 100 - 80 - 20 = 0 (filtered out), v2: 50 - 10 - 5 = 35
    expect(result.count).toBe(1);
    expect(result.vouchers[0].stats.availableForSale).toBe(35);
  });

  it('handles default stats when no code stats found', async () => {
    prisma.voucher.findMany.mockResolvedValue([
      { id: 'v1', totalIssued: 10, voucherCodes: [] },
    ]);
    prisma.$queryRaw.mockResolvedValue([]);

    const result = await handler.execute('m1');
    expect(result.vouchers[0].stats.totalCodes).toBe(0);
    expect(result.vouchers[0].stats.availableForSale).toBe(10);
  });

  it('rethrows errors', async () => {
    prisma.voucher.findMany.mockRejectedValue(new Error('fail'));
    await expect(handler.execute('m1')).rejects.toThrow('fail');
  });
});
