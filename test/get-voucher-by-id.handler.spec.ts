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
      voucher: {
        findUnique: jest.fn(),
      },
    };
    handler = new GetVoucherById(prisma);
    jest.clearAllMocks();
  });

  it('should return voucher with latest code and total codes', async () => {
    prisma.voucher.findUnique.mockResolvedValue(mockVoucher);

    const result = await handler.execute('v-1');

    expect(prisma.voucher.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'v-1' },
      }),
    );
    expect(result.id).toBe('v-1');
    expect(result.latestCode.id).toBe('vc-1'); // sorted desc by createdAt
    expect(result.totalCodes).toBe(2);
    expect(result.merchant.id).toBe('merchant-1');
  });

  it('should return null latestCode when no voucher codes', async () => {
    const voucherNoCodes = { ...mockVoucher, voucherCodes: [] };
    prisma.voucher.findUnique.mockResolvedValue(voucherNoCodes);

    const result = await handler.execute('v-1');

    expect(result.latestCode).toBeNull();
    expect(result.totalCodes).toBe(0);
  });

  it('should throw NotFoundException when voucher not found', async () => {
    prisma.voucher.findUnique.mockResolvedValue(null);

    await expect(handler.execute('nonexistent')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should throw InternalServerErrorException on unexpected error', async () => {
    prisma.voucher.findUnique.mockRejectedValue(new Error('DB failed'));

    await expect(handler.execute('v-1')).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
