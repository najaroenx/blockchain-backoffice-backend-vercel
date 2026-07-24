jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));
jest.mock('src/libs/convertBufferToAddress', () => ({
  convertBufferToAddress: jest.fn(
    (buf) => '0x' + Buffer.from(buf || []).toString('hex'),
  ),
}));

import {
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { GetMarketerDashboardHandler } from 'src/modules/internal/dashboard/handlers/get-marketer-dashboard.handler';
import { PrismaService } from 'prisma/prisma.service';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';

describe('GetMarketerDashboardHandler', () => {
  let handler: GetMarketerDashboardHandler;
  let prisma: any;
  let blockchainService: any;

  beforeEach(() => {
    prisma = {
      merchant: { findUnique: jest.fn(), findMany: jest.fn() },
      merchantRefStore: { findMany: jest.fn() },
      point: { findMany: jest.fn() },
      voucher: { findMany: jest.fn() },
      transaction: { findMany: jest.fn() },
      $queryRaw: jest.fn(),
    };
    blockchainService = { getBalance: jest.fn() };
    handler = new GetMarketerDashboardHandler(
      prisma as unknown as PrismaService,
      blockchainService as unknown as BlockchainService,
    );
  });

  const defaultQuery = {} as any;

  it('should throw NotFoundException when merchant not found', async () => {
    prisma.merchant.findUnique.mockResolvedValue(null);

    await expect(handler.execute('m1', defaultQuery)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should return dashboard data with all stats', async () => {
    prisma.merchant.findUnique
      .mockResolvedValueOnce({ id: 'm1', name: 'Merchant1' }) // validate merchant
      .mockResolvedValueOnce({
        id: 'm1',
        wallet: { walletAddress: '0xwallet' },
      }); // getPointsData

    // getCouponAndEndUserStats via $queryRaw
    prisma.$queryRaw.mockResolvedValueOnce([
      {
        id: 'vc1',
        pointsCost: 10,
        pointId: 'p1',
        currency: 'PT',
        currentOwnerId: 'c1',
        currentOwnerType: 'CUSTOMER',
        isUsed: false,
        listingBatchId: 'lb1',
        voucherId: 'v1',
        voucherMerchantId: 'm1',
        thbPurchasePrice: 50,
        pointSymbol: 'PT',
        batchTotalValue: null,
        batchTotalItems: null,
        thbBuyAmount: 50,
      },
      {
        id: 'vc2',
        pointsCost: 20,
        pointId: 'p1',
        currency: 'PT',
        currentOwnerId: 'c1',
        currentOwnerType: 'CUSTOMER',
        isUsed: true,
        listingBatchId: 'lb1',
        voucherId: 'v1',
        voucherMerchantId: 'm1',
        thbPurchasePrice: 60,
        pointSymbol: 'PT',
        batchTotalValue: null,
        batchTotalItems: null,
        thbBuyAmount: 60,
      },
      {
        id: 'vc3',
        pointsCost: 30,
        pointId: 'p1',
        currency: 'PT',
        currentOwnerId: 'm1',
        currentOwnerType: 'MERCHANT',
        isUsed: false,
        listingBatchId: 'lb1',
        voucherId: 'v1',
        voucherMerchantId: 'm1',
        thbPurchasePrice: 70,
        pointSymbol: 'PT',
        batchTotalValue: null,
        batchTotalItems: null,
        thbBuyAmount: 70,
      },
    ]);

    // getTransactionAndThbStats via $queryRaw
    prisma.$queryRaw.mockResolvedValueOnce([
      { transferPoint: 100, purchaseCoupon: 5, deposited: 1000, bought: 200 },
    ]);

    // getPointsData
    prisma.point.findMany.mockResolvedValue([
      {
        id: 'p1',
        name: 'Point1',
        symbol: 'PT',
        initialSupply: 10000,
        contractAddress: Buffer.from('abc', 'hex'),
      },
    ]);
    blockchainService.getBalance.mockResolvedValue({ balance: '5000' });

    const result = await handler.execute('m1', defaultQuery);

    expect(result.dateRange).toBeDefined();
    expect(result.couponCount).toEqual({
      total: 3,
      unsold: 1,
      sold: 2,
      unredeemed: 1,
      redeemed: 1,
    });
    expect(result.couponCount.total).toBe(
      result.couponCount.sold + result.couponCount.unsold,
    );
    expect(result.couponCount.sold).toBe(
      result.couponCount.unredeemed + result.couponCount.redeemed,
    );
    expect(result.couponValue.total).toBe(
      result.couponValue.sold + result.couponValue.unsold,
    );
    expect(result.couponValue.sold).toBe(
      result.couponValue.unredeemed + result.couponValue.redeemed,
    );
    expect(result.couponValueByCurrency[0]).toEqual({
      currency: 'PT',
      total: 60,
      unsold: 30,
      sold: 30,
      unredeemed: 10,
      redeemed: 20,
    });
    expect(result.transactions.transferPoint).toBe(100);
    expect(result.transactions.purchaseCoupon).toBe(5);
    expect(result.thbToken.deposited).toBe(1000);
    expect(result.thbToken.bought).toBe(200);
    expect(result.thbToken.balance).toBe(800);
    expect(result.points).toHaveLength(1);
    expect(result.points[0].balance).toBe('5000');
  });

  it('should handle zero stats gracefully', async () => {
    prisma.merchant.findUnique
      .mockResolvedValueOnce({ id: 'm1', name: 'M1' })
      .mockResolvedValueOnce({ id: 'm1', wallet: null });

    prisma.$queryRaw
      .mockResolvedValueOnce([]) // no voucher codes
      .mockResolvedValueOnce([
        { transferPoint: 0, purchaseCoupon: 0, deposited: 0, bought: 0 },
      ]);

    prisma.point.findMany.mockResolvedValue([]);

    const result = await handler.execute('m1', defaultQuery);

    expect(result.couponCount.total).toBe(0);
    expect(result.points).toEqual([]);
  });

  it('should throw InternalServerErrorException on unexpected error', async () => {
    prisma.merchant.findUnique.mockRejectedValue(new Error('DB fail'));

    await expect(handler.execute('m1', defaultQuery)).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  describe('getCouponDropdown', () => {
    it('should return coupons for marketer', async () => {
      prisma.transaction.findMany.mockResolvedValue([
        { voucherCode: { voucherId: 'v1' } },
      ]);
      prisma.voucher.findMany.mockResolvedValue([
        { id: 'v1', name: 'V1', merchantRef: 'ref-1' },
        { id: 'v2', name: 'V2', merchantRef: null },
      ]);
      prisma.merchantRefStore.findMany.mockResolvedValue([
        { merchantRef: 'ref-1', name: 'Store 1' },
      ]);

      const result = await handler.getCouponDropdown('m1');

      expect(result.coupons).toEqual([
        {
          id: 'v1',
          name: 'V1',
          merchantRef: 'ref-1',
          merchantRefName: 'Store 1',
        },
        {
          id: 'v2',
          name: 'V2',
          merchantRef: null,
          merchantRefName: null,
        },
      ]);
    });

    it('should return empty when no purchases', async () => {
      prisma.transaction.findMany.mockResolvedValue([]);
      prisma.voucher.findMany.mockResolvedValue([]);

      const result = await handler.getCouponDropdown('m1');
      expect(result.coupons).toEqual([]);
    });
  });
});
