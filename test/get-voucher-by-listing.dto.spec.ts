import 'reflect-metadata';

jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import { GetVoucherByListingResponseDto } from 'src/modules/internal/voucher/dtos/get-voucher-by-listing.dto';

describe('GetVoucherByListingResponseDto', () => {
  it('should instantiate with all properties', () => {
    const dto = {} as GetVoucherByListingResponseDto;
    dto.id = 'vc-001';
    dto.code = 'CODE-001';
    dto.voucherId = 'v-001';
    dto.voucherGroupId = 'vg-001';
    dto.pointsCost = 100;
    dto.thbPrice = 50;
    dto.pointId = 'p-001';
    dto.currency = 'THB';
    dto.isUsed = false;
    dto.usedBy = undefined;
    dto.usedAt = undefined;
    dto.currentOwnerId = 'cust-001';
    dto.currentOwnerType = 'CUSTOMER';
    dto.createdAt = new Date();
    dto.listingBatchId = 'lb-001';
    dto.voucher = {
      id: 'v-001',
      name: 'Test Voucher',
      description: 'A voucher',
      status: 'active',
      merchantName: 'Test Merchant',
      merchantId: 'm-001',
      merchantRef: 'ref-001',
      sellerMerchantId: 'sm-001',
      tokenId: '1',
      valueType: 'cash',
      value: 100,
      thbPurchasePrice: 50,
      currency: 'THB',
      startDate: new Date(),
      endDate: new Date(),
      totalIssued: 100,
      totalRedeemed: 10,
      totalAvailable: 90,
      imageUrl: 'https://example.com/img.png',
      limitPerMember: 5,
      createdAt: new Date(),
      updatedAt: new Date(),
      merchant: { id: 'm-001', name: 'Test' },
    } as any;
    dto.point = {
      id: 'p-001',
      name: 'Test Point',
      symbol: 'TP',
      contractAddress: Buffer.from('abc'),
      imageUrl: 'https://example.com/point.png',
    } as any;

    expect(dto.id).toBe('vc-001');
    expect(dto.code).toBe('CODE-001');
    expect(dto.voucher.name).toBe('Test Voucher');
    expect(dto.point.symbol).toBe('TP');
    expect(dto.isUsed).toBe(false);
    expect(dto.pointsCost).toBe(100);
  });

  it('should work with minimal properties', () => {
    const dto = {} as GetVoucherByListingResponseDto;
    dto.id = 'vc-002';
    dto.code = 'CODE-002';
    dto.voucherId = 'v-002';
    dto.voucherGroupId = 'vg-002';
    dto.pointsCost = 0;
    dto.thbPrice = 0;
    dto.currency = 'THB';
    dto.isUsed = true;
    dto.usedBy = 'user-001';
    dto.usedAt = new Date();
    dto.createdAt = new Date();
    dto.voucher = {
      id: 'v-002',
      name: 'Minimal Voucher',
      status: 'expired',
      tokenId: '2',
      valueType: 'percentage',
      value: 10,
      currency: 'THB',
      startDate: new Date(),
      endDate: new Date(),
      totalIssued: 50,
      totalRedeemed: 50,
      totalAvailable: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;

    expect(dto.isUsed).toBe(true);
    expect(dto.usedBy).toBe('user-001');
    expect(dto.point).toBeUndefined();
  });
});
