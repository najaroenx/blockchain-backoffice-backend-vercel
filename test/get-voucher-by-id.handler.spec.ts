jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));
import {
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { GetVoucherById } from 'src/modules/internal/voucher/handlers/getVoucherById.handler';

describe('GetVoucherById', () => {
  let handler: GetVoucherById;
  let prisma: any;
  let merchantRefEnrichment: any;

  const mockVoucher = {
    id: 'v-1',
    name: 'Test Voucher',
    description: 'A test voucher',
    imageUrl: 'https://example.com/img.png',
    status: 'ACTIVE',
    valueType: 'FIXED',
    value: 100,
    currency: 'THB',
    startDate: new Date('2025-01-01'),
    endDate: new Date('2025-12-31'),
    tokenId: 'token-1',
    totalRedeemed: 0,
    merchantId: 'merchant-1',
    merchantName: 'Test Merchant',
    merchantRef: 'ref-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    merchant: {
      id: 'merchant-1',
      name: 'Test Merchant',
      description: 'Desc',
      imageUrl: null,
      website: null,
    },
    voucherCodes: [
      {
        id: 'vc-1',
        code: 'CODE001',
        pointsCost: 50,
        currency: 'THB',
        isUsed: false,
        usedAt: null,
        usedBy: null,
        currentOwnerId: null,
        createdAt: new Date('2025-06-01'),
      },
      {
        id: 'vc-2',
        code: 'CODE002',
        pointsCost: 50,
        currency: 'THB',
        isUsed: true,
        usedAt: new Date(),
        usedBy: 'customer-1',
        currentOwnerId: 'customer-1',
        createdAt: new Date('2025-05-01'),
      },
    ],
  };

  beforeEach(() => {
    prisma = {
      $queryRaw: jest.fn(),
    };
    merchantRefEnrichment = {
      enrich: jest.fn(),
    };
    handler = new GetVoucherById(prisma, merchantRefEnrichment);
    jest.clearAllMocks();
  });

  it('should return voucher with latest code and total codes', async () => {
    prisma.$queryRaw.mockResolvedValue([
      {
        id: 'v-1',
        name: 'Test Voucher',
        description: 'A test voucher',
        imageUrl: 'https://example.com/img.png',
        status: 'ACTIVE',
        valueType: 'FIXED',
        value: 100,
        currency: 'THB',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-12-31'),
        tokenId: 'token-1',
        totalRedeemed: 0,
        merchantId: 'merchant-1',
        merchantName: 'Test Merchant',
        merchantRef: 'ref-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        m_id: 'merchant-1',
        m_name: 'Test Merchant',
        m_description: 'Desc',
        m_imageUrl: null,
        m_website: null,
        lc_id: 'vc-1',
        lc_code: 'CODE001',
        lc_pointsCost: 50,
        lc_currency: 'THB',
        lc_isUsed: false,
        lc_usedAt: null,
        lc_usedBy: null,
        lc_currentOwnerId: null,
        lc_createdAt: new Date('2025-06-01'),
        totalCodes: BigInt(2),
      },
    ]);
    merchantRefEnrichment.enrich.mockResolvedValue({
      id: 'mrs-1',
      merchantRef: 'ref-1',
      name: 'Store 1',
      category: 'Cafe',
      description: 'Desc',
      imageUrl: null,
      locationUrl: null,
      website: null,
      isActive: true,
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-02'),
    });

    const result = await handler.execute('v-1');

    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(merchantRefEnrichment.enrich).toHaveBeenCalledWith('ref-1');
    expect(result.id).toBe('v-1');
    expect(result.latestCode.id).toBe('vc-1'); // sorted desc by createdAt
    expect(result.totalCodes).toBe(2);
    expect(result.merchant.id).toBe('merchant-1');
    expect(result.merchantRefDetail).toEqual(
      expect.objectContaining({
        id: 'mrs-1',
        merchantRef: 'ref-1',
      }),
    );
  });

  it('should return null latestCode when no voucher codes', async () => {
    prisma.$queryRaw.mockResolvedValue([
      {
        id: 'v-1',
        name: 'Test Voucher',
        description: 'A test voucher',
        imageUrl: 'https://example.com/img.png',
        status: 'ACTIVE',
        valueType: 'FIXED',
        value: 100,
        currency: 'THB',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-12-31'),
        tokenId: 'token-1',
        totalRedeemed: 0,
        merchantId: 'merchant-1',
        merchantName: 'Test Merchant',
        merchantRef: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        m_id: 'merchant-1',
        m_name: 'Test Merchant',
        m_description: 'Desc',
        m_imageUrl: null,
        m_website: null,
        lc_id: null,
        lc_code: null,
        lc_pointsCost: null,
        lc_currency: null,
        lc_isUsed: null,
        lc_usedAt: null,
        lc_usedBy: null,
        lc_currentOwnerId: null,
        lc_createdAt: null,
        totalCodes: BigInt(0),
      },
    ]);

    const result = await handler.execute('v-1');

    expect(result.latestCode).toBeNull();
    expect(result.totalCodes).toBe(0);
    expect(result.merchantRefDetail).toBeNull();
  });

  it('should throw NotFoundException when voucher not found', async () => {
    prisma.$queryRaw.mockResolvedValue([]);

    await expect(handler.execute('nonexistent')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should throw InternalServerErrorException on unexpected error', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('DB failed'));

    await expect(handler.execute('v-1')).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
