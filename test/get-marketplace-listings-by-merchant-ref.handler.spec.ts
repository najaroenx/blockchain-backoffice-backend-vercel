jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));
jest.mock('src/libs/convertBufferToAddress', () => ({
  convertBufferToAddress: jest.fn(
    (buf) => '0x' + Buffer.from(buf || []).toString('hex'),
  ),
}));

import { GetMarketplaceListingsByMerchantRef } from 'src/modules/internal/voucher/handlers/getMarketplaceListingsByMerchantRef.handler';

describe('GetMarketplaceListingsByMerchantRef', () => {
  let handler: GetMarketplaceListingsByMerchantRef;
  let mockBlockchain: any;
  let mockPrisma: any;
  let mockConfig: any;
  let mockMerchantRefEnrichment: any;

  beforeEach(() => {
    mockBlockchain = {
      getAllActiveMarketplaceListings: jest.fn(),
    };
    mockPrisma = {
      $queryRaw: jest.fn(),
    };
    mockConfig = {
      get: jest.fn().mockReturnValue('0xTHBAddress'),
    };
    mockMerchantRefEnrichment = {
      enrich: jest.fn().mockResolvedValue({ name: 'Store', branchId: 'b1' }),
    };
    handler = new GetMarketplaceListingsByMerchantRef(
      mockBlockchain as any,
      mockPrisma as any,
      mockConfig as any,
      mockMerchantRefEnrichment as any,
    );
  });

  it('should return empty when no blockchain listings', async () => {
    mockBlockchain.getAllActiveMarketplaceListings.mockResolvedValue([]);
    const result = await handler.execute('ref1');
    expect(result).toEqual({ total: 0, listings: [] });
  });

  it('should return paginated empty when no listings with pagination', async () => {
    mockBlockchain.getAllActiveMarketplaceListings.mockResolvedValue([]);
    const result = await handler.execute('ref1', 1, 10);
    expect(result).toEqual({
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 0,
      listings: [],
    });
  });

  it('should return listings filtered by merchantRef', async () => {
    mockBlockchain.getAllActiveMarketplaceListings.mockResolvedValue([
      {
        listingId: '1',
        paymentToken: '0xtoken',
        seller: '0xseller',
        amount: '5',
        typeId: '1',
        pricePerUnit: '100',
        isActive: true,
        listedAt: '123',
      },
    ]);
    mockPrisma.$queryRaw
      .mockResolvedValueOnce([
        {
          voucherGroupId: '1',
          codeId: 'c1',
          codeCurrentOwnerId: null,
          codeCurrentOwnerType: null,
          voucherId: 'v1',
          voucherName: 'Test',
          voucherDescription: 'D',
          voucherImageUrl: null,
          voucherValueType: 'fixed',
          voucherValue: 100,
          voucherMerchantRef: 'ref1',
          voucherStartDate: null,
          voucherEndDate: new Date(Date.now() + 86400000),
          voucherStatus: 'active',
          voucherMerchantId: 'm1',
          voucherSellerMerchantId: null,
          merchantId: 'm1',
          merchantName: 'M1',
          merchantImageUrl: null,
          merchantWalletAddress: '0xseller',
          pointId: 'p1',
          pointName: 'P',
          pointSymbol: 'PTS',
          pointContractAddress: Buffer.from('ab', 'hex'),
          pointImageUrl: null,
        },
      ])
      .mockResolvedValueOnce([
        { voucherGroupId: '1', availableCount: BigInt(5) },
      ]);

    const result = await handler.execute('ref1');
    expect(result.total).toBe(1);
    expect(result.listings).toHaveLength(1);
    expect(mockMerchantRefEnrichment.enrich).toHaveBeenCalledWith('ref1');
  });

  it('should skip listings without DB detail', async () => {
    mockBlockchain.getAllActiveMarketplaceListings.mockResolvedValue([
      {
        listingId: '1',
        paymentToken: '0xtoken',
        seller: '0xseller',
        amount: '5',
        typeId: '1',
        pricePerUnit: '100',
        isActive: true,
        listedAt: '123',
      },
    ]);
    mockPrisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const result = await handler.execute('ref1');
    expect(result.total).toBe(0);
  });

  it('should filter expired vouchers', async () => {
    mockBlockchain.getAllActiveMarketplaceListings.mockResolvedValue([
      {
        listingId: '1',
        paymentToken: '0xtoken',
        seller: '0xseller',
        amount: '5',
        typeId: '1',
        pricePerUnit: '100',
        isActive: true,
        listedAt: '123',
      },
    ]);
    mockPrisma.$queryRaw
      .mockResolvedValueOnce([
        {
          voucherGroupId: '1',
          codeId: 'c1',
          codeCurrentOwnerId: null,
          codeCurrentOwnerType: null,
          voucherId: 'v1',
          voucherName: 'Expired',
          voucherDescription: '',
          voucherImageUrl: null,
          voucherValueType: 'fixed',
          voucherValue: 50,
          voucherMerchantRef: 'ref1',
          voucherStartDate: null,
          voucherEndDate: new Date(Date.now() - 86400000),
          voucherStatus: 'active',
          voucherMerchantId: 'm1',
          voucherSellerMerchantId: null,
          merchantId: 'm1',
          merchantName: 'M',
          merchantImageUrl: null,
          merchantWalletAddress: '0xw',
          pointId: null,
          pointName: null,
          pointSymbol: null,
          pointContractAddress: null,
          pointImageUrl: null,
        },
      ])
      .mockResolvedValueOnce([
        { voucherGroupId: '1', availableCount: BigInt(5) },
      ]);

    const result = await handler.execute('ref1');
    expect(result.total).toBe(0);
  });

  it('should handle pagination correctly', async () => {
    const listings = Array.from({ length: 5 }, (_, i) => ({
      listingId: `${i + 1}`,
      paymentToken: '0xtoken',
      seller: '0xseller',
      amount: '5',
      typeId: '1',
      pricePerUnit: '100',
      isActive: true,
      listedAt: '123',
    }));
    mockBlockchain.getAllActiveMarketplaceListings.mockResolvedValue(listings);

    const details = listings.map((l) => ({
      voucherGroupId: l.listingId,
      codeId: `c${l.listingId}`,
      codeCurrentOwnerId: null,
      codeCurrentOwnerType: null,
      voucherId: `v${l.listingId}`,
      voucherName: `V`,
      voucherDescription: '',
      voucherImageUrl: null,
      voucherValueType: 'fixed',
      voucherValue: 50,
      voucherMerchantRef: 'ref1',
      voucherStartDate: null,
      voucherEndDate: new Date(Date.now() + 86400000),
      voucherStatus: 'active',
      voucherMerchantId: 'm1',
      voucherSellerMerchantId: null,
      merchantId: 'm1',
      merchantName: 'M',
      merchantImageUrl: null,
      merchantWalletAddress: '0xseller',
      pointId: 'p1',
      pointName: 'P',
      pointSymbol: 'P',
      pointContractAddress: null,
      pointImageUrl: null,
    }));
    const counts = listings.map((l) => ({
      voucherGroupId: l.listingId,
      availableCount: BigInt(3),
    }));

    mockPrisma.$queryRaw
      .mockResolvedValueOnce(details)
      .mockResolvedValueOnce(counts);

    const result = await handler.execute('ref1', 1, 2);
    expect(result).toHaveProperty('page', 1);
    expect(result).toHaveProperty('limit', 2);
    expect(result).toHaveProperty('totalPages', 3);
    expect(result.listings).toHaveLength(2);
  });

  it('should rethrow errors', async () => {
    mockBlockchain.getAllActiveMarketplaceListings.mockRejectedValue(
      new Error('RPC fail'),
    );
    await expect(handler.execute('ref1')).rejects.toThrow('RPC fail');
  });
});
