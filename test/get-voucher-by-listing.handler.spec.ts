import { BadRequestException } from '@nestjs/common';
import { GetVoucherByListingId } from 'src/modules/internal/voucher/handlers/getVoucherByListingId.handler';

describe('GetVoucherByListingId', () => {
  let handler: GetVoucherByListingId;
  let mockBlockchainService: any;
  let mockPrisma: any;
  let mockMerchantRefEnrichment: any;

  beforeEach(() => {
    mockBlockchainService = {
      getMarketplaceListing: jest.fn(),
    };

    mockPrisma = {
      voucherCode: {
        findFirst: jest.fn(),
        count: jest.fn(),
      },
      merchant: {
        findUnique: jest.fn(),
      },
    };

    mockMerchantRefEnrichment = {
      enrich: jest.fn(),
    };

    handler = new GetVoucherByListingId(
      mockBlockchainService,
      mockPrisma,
      mockMerchantRefEnrichment,
    );
  });

  it('should use on-chain listing amount as totalAvailable and DB used count as totalRedeemed', async () => {
    mockBlockchainService.getMarketplaceListing.mockResolvedValue({
      seller: '0xSeller',
      typeId: '55',
      amount: '5',
      pricePerUnit: '1',
      paymentToken: '0xToken',
      isActive: true,
      listedAt: 1730000000,
    });

    mockPrisma.voucherCode.findFirst.mockResolvedValue({
      id: 'vc1',
      code: 'CODE-1',
      voucherId: 'voucher-1',
      voucherGroupId: '123',
      pointsCost: 100,
      thbPrice: 50,
      pointId: 'point-1',
      currency: 'PTS',
      isUsed: false,
      usedBy: null,
      usedAt: null,
      currentOwnerId: 'merchant-1',
      currentOwnerType: 'MERCHANT',
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      listingBatchId: null,
      voucher: {
        id: 'voucher-1',
        tokenId: '55',
        name: 'Voucher 1',
        description: 'desc',
        status: 'ACTIVE',
        merchantId: 'merchant-1',
        merchantName: 'Merchant 1',
        merchantRef: 'merchant-ref-1',
        sellerMerchantId: null,
        valueType: 'FIXED',
        value: 100,
        thbPurchasePrice: 50,
        currency: 'PTS',
        startDate: new Date('2026-03-01T00:00:00.000Z'),
        endDate: new Date('2026-12-31T23:59:59.000Z'),
        totalIssued: 10,
        imageUrl: 'https://example.com/image.png',
        limitPerMember: 1,
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        updatedAt: new Date('2026-03-02T00:00:00.000Z'),
        merchant: {
          id: 'merchant-1',
          name: 'Merchant 1',
          wallet: {
            walletAddress: '0xMerchantWallet',
          },
        },
      },
      point: {
        id: 'point-1',
        name: 'Point 1',
        symbol: 'PTS',
        contractAddress: {},
        imageUrl: 'https://example.com/point.png',
        merchant: {
          id: 'merchant-1',
        },
      },
    });

    mockPrisma.voucherCode.count
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(2);
    mockMerchantRefEnrichment.enrich.mockResolvedValue({
      merchantId: 'merchant-1',
      merchantName: 'Merchant 1',
    });

    const result = await handler.execute('123');

    expect(result.voucher.totalAvailable).toBe(5);
    expect(result.voucher.totalRedeemed).toBe(2);
    expect(mockPrisma.voucherCode.count).toHaveBeenNthCalledWith(1, {
      where: {
        voucherId: 'voucher-1',
        voucherGroupId: '123',
        isUsed: false,
        OR: [
          {
            currentOwnerType: null,
          },
          {
            currentOwnerType: {
              not: 'CUSTOMER',
            },
          },
        ],
      },
    });
    expect(mockPrisma.voucherCode.count).toHaveBeenNthCalledWith(2, {
      where: {
        voucherId: 'voucher-1',
        voucherGroupId: '123',
        isUsed: true,
      },
    });
  });

  it('should rethrow blockchain HTTP errors without collapsing them', async () => {
    mockBlockchainService.getMarketplaceListing.mockRejectedValue(
      new BadRequestException('Invalid listing ID: abc'),
    );

    await expect(handler.execute('abc')).rejects.toThrow(BadRequestException);
  });
});
