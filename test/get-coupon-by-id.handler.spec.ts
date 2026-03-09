jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));
import {
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { GetCouponById } from 'src/modules/internal/voucher/handlers/getCouponById.handler';

describe('GetCouponById', () => {
  let handler: GetCouponById;
  let prisma: any;
  let merchantRefEnrichment: any;

  const mockVoucherCode = {
    id: 'vc-1',
    code: 'CODE001',
    pointsCost: 50,
    thbPrice: 100,
    currency: 'THB',
    isUsed: false,
    usedAt: null,
    usedBy: null,
    currentOwnerId: null,
    currentOwnerType: null,
    voucherGroupId: 'vg-1',
    listingBatchId: 'lb-1',
    createdAt: new Date(),
    voucher: {
      id: 'v-1',
      name: 'Test Voucher',
      description: 'Desc',
      imageUrl: null,
      valueType: 'FIXED',
      value: 100,
      currency: 'THB',
      status: 'ACTIVE',
      startDate: new Date(),
      endDate: new Date(),
      tokenId: 'token-1',
      merchantId: 'merchant-1',
      merchantName: 'Test Merchant',
      merchantRef: 'ref-1',
      thbPurchasePrice: 50,
    },
    point: {
      id: 'p-1',
      name: 'Points',
      symbol: 'PTS',
      imageUrl: null,
    },
  };

  beforeEach(() => {
    prisma = {
      voucherCode: { findUnique: jest.fn() },
      merchant: { findUnique: jest.fn() },
    };
    merchantRefEnrichment = {
      enrich: jest.fn(),
    };
    handler = new GetCouponById(prisma, merchantRefEnrichment);
    jest.clearAllMocks();
  });

  it('should return coupon with voucher, merchant, and point', async () => {
    prisma.voucherCode.findUnique.mockResolvedValue(mockVoucherCode);
    prisma.merchant.findUnique.mockResolvedValue({
      id: 'merchant-1',
      name: 'Test Merchant',
      imageUrl: null,
      description: 'Desc',
    });
    merchantRefEnrichment.enrich.mockResolvedValue({
      id: 'mref-1',
      merchantRef: 'ref-1',
      name: 'Merchant Ref Name',
      category: 'food',
      description: 'Merchant ref description',
      imageUrl: null,
      locationUrl: null,
      website: null,
      isActive: true,
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-02T00:00:00.000Z'),
    });

    const result = await handler.execute('vc-1');

    expect(result.id).toBe('vc-1');
    expect(result.code).toBe('CODE001');
    expect(result.voucher.name).toBe('Test Voucher');
    expect(result.voucher.merchantRefDetail).toEqual(
      expect.objectContaining({
        merchantRef: 'ref-1',
        name: 'Merchant Ref Name',
      }),
    );
    expect(result.merchant.id).toBe('merchant-1');
    expect(result.point.id).toBe('p-1');
  });

  it('should return null merchant when voucher has no merchantId', async () => {
    const codeNoMerchant = {
      ...mockVoucherCode,
      voucher: { ...mockVoucherCode.voucher, merchantId: null },
    };
    prisma.voucherCode.findUnique.mockResolvedValue(codeNoMerchant);
    merchantRefEnrichment.enrich.mockResolvedValue(null);

    const result = await handler.execute('vc-1');

    expect(result.merchant).toBeNull();
    expect(prisma.merchant.findUnique).not.toHaveBeenCalled();
  });

  it('should return null point when no point associated', async () => {
    const codeNoPoint = { ...mockVoucherCode, point: null };
    prisma.voucherCode.findUnique.mockResolvedValue(codeNoPoint);
    prisma.merchant.findUnique.mockResolvedValue({ id: 'merchant-1' });
    merchantRefEnrichment.enrich.mockResolvedValue(null);

    const result = await handler.execute('vc-1');

    expect(result.point).toBeNull();
  });

  it('should return null merchantRefDetail when voucher has no merchantRef', async () => {
    const codeWithoutMerchantRef = {
      ...mockVoucherCode,
      voucher: { ...mockVoucherCode.voucher, merchantRef: null },
    };
    prisma.voucherCode.findUnique.mockResolvedValue(codeWithoutMerchantRef);
    prisma.merchant.findUnique.mockResolvedValue({ id: 'merchant-1' });

    const result = await handler.execute('vc-1');

    expect(result.voucher.merchantRefDetail).toBeNull();
    expect(merchantRefEnrichment.enrich).not.toHaveBeenCalled();
  });

  it('should throw NotFoundException when coupon not found', async () => {
    prisma.voucherCode.findUnique.mockResolvedValue(null);

    await expect(handler.execute('nonexistent')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should throw InternalServerErrorException on unexpected error', async () => {
    prisma.voucherCode.findUnique.mockRejectedValue(new Error('DB failed'));

    await expect(handler.execute('vc-1')).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
