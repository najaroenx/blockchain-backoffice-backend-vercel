jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import { InternalServerErrorException } from '@nestjs/common';
import { GetSellerDashboardHandler } from 'src/modules/internal/dashboard/handlers/get-seller-dashboard.handler';
import { PrismaService } from 'prisma/prisma.service';

describe('GetSellerDashboardHandler', () => {
  let handler: GetSellerDashboardHandler;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      $queryRaw: jest.fn(),
      voucher: { findMany: jest.fn() },
      transaction: { findMany: jest.fn() },
      merchant: { findMany: jest.fn() },
      merchantRefStore: { findMany: jest.fn() },
    };
    handler = new GetSellerDashboardHandler(prisma as unknown as PrismaService);
  });

  const defaultQuery = {} as any;

  it('should return empty response when seller wallet not found', async () => {
    // findSellerWalletAddress returns null
    prisma.$queryRaw.mockResolvedValueOnce([]);

    const result = await handler.execute('m1', defaultQuery);

    expect(result.dateRange).toBeDefined();
    expect(result.overallSummary.couponCount.total).toBe(0);
  });

  it('should return empty response when no voucher codes', async () => {
    // findSellerWalletAddress
    prisma.$queryRaw.mockResolvedValueOnce([
      { sellerWalletAddress: '0xseller' },
    ]);
    // allVoucherCodes
    prisma.$queryRaw.mockResolvedValueOnce([]);
    // vouchersFromSeller
    prisma.$queryRaw.mockResolvedValueOnce([]);

    const result = await handler.execute('m1', defaultQuery);

    expect(result.overallSummary.couponCount.total).toBe(0);
  });

  it('should calculate overall summary with voucher codes', async () => {
    // findSellerWalletAddress
    prisma.$queryRaw.mockResolvedValueOnce([
      { sellerWalletAddress: '0xseller' },
    ]);
    // allVoucherCodes
    prisma.$queryRaw.mockResolvedValueOnce([
      {
        id: 'vc1',
        voucherId: 'v1',
        thbPrice: 100,
        isUsed: false,
        listingBatchId: 'lb1',
        currentOwnerId: 'm2',
        currentOwnerType: 'MERCHANT',
        voucherThbPurchasePrice: 100,
      },
      {
        id: 'vc2',
        voucherId: 'v1',
        thbPrice: 100,
        isUsed: true,
        listingBatchId: 'lb1',
        currentOwnerId: 'c1',
        currentOwnerType: 'CUSTOMER',
        voucherThbPurchasePrice: 100,
      },
      {
        id: 'vc3',
        voucherId: 'v1',
        thbPrice: 100,
        isUsed: false,
        listingBatchId: null,
        currentOwnerId: null,
        currentOwnerType: null,
        voucherThbPurchasePrice: 100,
      },
    ]);
    // vouchersFromSeller
    prisma.$queryRaw.mockResolvedValueOnce([
      { id: 'v1', totalIssued: 5, thbPurchasePrice: 100 },
    ]);
    // THB_BUY transactions (for reservedCodeMap)
    prisma.$queryRaw.mockResolvedValueOnce([
      { merchantId: 'm2', voucherCodeId: 'vc1' },
    ]);

    const result = await handler.execute('m1', defaultQuery);

    expect(result.overallSummary.couponCount.total).toBeGreaterThan(0);
    expect(result.overallSummary.couponCount.sold).toBeGreaterThan(0);
  });

  it('should throw InternalServerErrorException on error', async () => {
    prisma.$queryRaw.mockRejectedValueOnce(new Error('DB fail'));

    await expect(handler.execute('m1', defaultQuery)).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  describe('getCouponDropdown', () => {
    it('should return all coupons when no marketerMerchantId', async () => {
      prisma.voucher = {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'v1', name: 'V1', merchantRef: 'ref-1' }]),
      };
      prisma.merchantRefStore.findMany.mockResolvedValue([
        { merchantRef: 'ref-1', name: 'Store 1' },
      ]);

      const result = await handler.getCouponDropdown('seller1');

      expect(result.coupons).toEqual([
        {
          id: 'v1',
          name: 'V1',
          merchantRef: 'ref-1',
          merchantRefName: 'Store 1',
        },
      ]);
    });

    it('should filter by marketer purchases', async () => {
      prisma.transaction = {
        findMany: jest.fn().mockResolvedValue([
          {
            voucherCode: {
              voucherId: 'v1',
              voucher: { sellerMerchantId: 'seller1' },
            },
          },
          {
            voucherCode: {
              voucherId: 'v2',
              voucher: { sellerMerchantId: 'other' },
            },
          },
        ]),
      };
      prisma.voucher = {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'v1', name: 'V1', merchantRef: 'ref-1' }]),
      };
      prisma.merchantRefStore.findMany.mockResolvedValue([
        { merchantRef: 'ref-1', name: 'Store 1' },
      ]);

      await handler.getCouponDropdown('seller1', 'marketer1');

      expect(prisma.voucher.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: ['v1'] } },
        }),
      );
      expect(prisma.merchantRefStore.findMany).toHaveBeenCalledWith({
        where: { merchantRef: { in: ['ref-1'] } },
        select: { merchantRef: true, name: true },
      });
    });

    it('should return empty when marketer has no purchases from seller', async () => {
      prisma.transaction = { findMany: jest.fn().mockResolvedValue([]) };

      const result = await handler.getCouponDropdown('seller1', 'marketer1');

      expect(result.coupons).toEqual([]);
    });
  });

  describe('getMerchants', () => {
    it('should return empty when seller wallet not found', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([]);

      const result = await handler.getMerchants('m1');

      expect(result.merchants).toEqual([]);
    });

    it('should return empty when no sold codes', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([
        { sellerWalletAddress: '0xseller' },
      ]);
      prisma.$queryRaw.mockResolvedValueOnce([]);

      const result = await handler.getMerchants('m1');

      expect(result.merchants).toEqual([]);
    });

    it('should return merchant breakdown', async () => {
      // findSellerWalletAddress
      prisma.$queryRaw.mockResolvedValueOnce([
        { sellerWalletAddress: '0xseller' },
      ]);
      // soldCodesWithMerchant
      prisma.$queryRaw.mockResolvedValueOnce([
        {
          id: 'vc1',
          voucherId: 'v1',
          thbPrice: 100,
          isUsed: false,
          listingBatchId: 'lb1',
          currentOwnerId: 'm2',
          currentOwnerType: 'MERCHANT',
          voucherThbPurchasePrice: 100,
          buyerMerchantId: 'm2',
        },
      ]);
      // merchant names
      prisma.merchant = {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'm2', name: 'Marketer2' }]),
      };

      const result = await handler.getMerchants('m1');

      expect(result.merchants).toHaveLength(1);
      expect(result.merchants[0].merchantId).toBe('m2');
      expect(result.merchants[0].merchantName).toBe('Marketer2');
    });
  });
});
