import { Test, TestingModule } from '@nestjs/testing';
import { GetSellerListingsHandler } from '../src/modules/voucher/handlers/getSellerListings.handler';
import { PrismaService } from '../prisma/prisma.service';
import { MockDataFactory } from './fixtures/mock-data.factory';
import { ListingBatchStatus } from '@prisma/client';

describe('GetSellerListingsHandler', () => {
  let handler: GetSellerListingsHandler;
  let prismaService: any;

  const mockListingBatch = MockDataFactory.createMockListingBatch({
    voucherCodes: [
      { voucherId: 'voucher-1' },
      { voucherId: 'voucher-1' },
      { voucherId: 'voucher-2' },
    ],
  });

  const mockListingBatch2 = MockDataFactory.createMockListingBatch({
    id: 'batch-456',
    name: 'Second Batch',
    totalItems: 50,
    soldItems: 25,
    status: 'ACTIVE' as ListingBatchStatus,
    voucherCodes: [{ voucherId: 'voucher-3' }],
  });

  beforeEach(async () => {
    const mockPrismaService = {
      listingBatch: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetSellerListingsHandler,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    handler = module.get<GetSellerListingsHandler>(GetSellerListingsHandler);
    prismaService = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    const sellerWalletAddress = '0xf5e40ec8bfa4818278c04489b34a486281658e5c';

    it('should return paginated listings for seller', async () => {
      prismaService.listingBatch.count.mockResolvedValue(2);
      prismaService.listingBatch.findMany.mockResolvedValue([
        mockListingBatch,
        mockListingBatch2,
      ]);

      const result = await handler.execute(sellerWalletAddress, 1, 20);

      expect(result.listings).toHaveLength(2);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(20);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.totalPages).toBe(1);
    });

    it('should calculate remainingItems correctly', async () => {
      prismaService.listingBatch.count.mockResolvedValue(1);
      prismaService.listingBatch.findMany.mockResolvedValue([
        mockListingBatch2,
      ]);

      const result = await handler.execute(sellerWalletAddress);

      const listing = result.listings[0];
      expect(listing.remainingItems).toBe(25); // 50 - 25
    });

    it('should count unique voucher types in batch', async () => {
      prismaService.listingBatch.count.mockResolvedValue(1);
      prismaService.listingBatch.findMany.mockResolvedValue([mockListingBatch]);

      const result = await handler.execute(sellerWalletAddress);

      // mockListingBatch has voucher-1 (x2) and voucher-2 (x1) = 2 unique types
      expect(result.listings[0].voucherTypes).toBe(2);
    });

    it('should filter by status when provided', async () => {
      prismaService.listingBatch.count.mockResolvedValue(1);
      prismaService.listingBatch.findMany.mockResolvedValue([mockListingBatch]);

      await handler.execute(
        sellerWalletAddress,
        1,
        20,
        'ACTIVE' as ListingBatchStatus,
      );

      expect(prismaService.listingBatch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'ACTIVE',
          }),
        }),
      );
    });

    it('should return empty listings when no batches found', async () => {
      prismaService.listingBatch.count.mockResolvedValue(0);
      prismaService.listingBatch.findMany.mockResolvedValue([]);

      const result = await handler.execute(sellerWalletAddress);

      expect(result.listings).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
      expect(result.pagination.totalPages).toBe(0);
    });

    it('should use lowercase wallet address for query', async () => {
      const upperCaseAddress = '0xF5E40EC8BFA4818278C04489B34A486281658E5C';
      prismaService.listingBatch.count.mockResolvedValue(0);
      prismaService.listingBatch.findMany.mockResolvedValue([]);

      await handler.execute(upperCaseAddress);

      expect(prismaService.listingBatch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            sellerWalletAddress: upperCaseAddress.toLowerCase(),
          }),
        }),
      );
    });

    it('should correctly calculate total pages', async () => {
      prismaService.listingBatch.count.mockResolvedValue(55);
      prismaService.listingBatch.findMany.mockResolvedValue([mockListingBatch]);

      const result = await handler.execute(sellerWalletAddress, 1, 10);

      expect(result.pagination.totalPages).toBe(6); // ceil(55/10) = 6
    });
  });
});
