import { Test, TestingModule } from '@nestjs/testing';
import { GetListingBatchDetailHandler } from '../src/modules/voucher/handlers/getListingBatchDetail.handler';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { MockDataFactory } from './fixtures/mock-data.factory';

describe('GetListingBatchDetailHandler', () => {
  let handler: GetListingBatchDetailHandler;
  let prismaService: any;

  const mockListingBatch = MockDataFactory.createMockListingBatch({
    id: 'batch-123',
    totalItems: 10,
    soldItems: 3,
  });

  const mockVoucherCodes = [
    {
      id: 'code-1',
      voucherId: 'voucher-1',
      voucherGroupId: 'listing-100',
      pointsCost: 100,
      currency: 'THB',
      currentOwnerId: null,
      voucher: { id: 'voucher-1', name: 'Voucher A', tokenId: '12345' },
    },
    {
      id: 'code-2',
      voucherId: 'voucher-1',
      voucherGroupId: 'listing-100',
      pointsCost: 100,
      currency: 'THB',
      currentOwnerId: 'customer-1', // Sold
      voucher: { id: 'voucher-1', name: 'Voucher A', tokenId: '12345' },
    },
    {
      id: 'code-3',
      voucherId: 'voucher-2',
      voucherGroupId: 'listing-200',
      pointsCost: 50,
      currency: 'THB',
      currentOwnerId: null,
      voucher: { id: 'voucher-2', name: 'Voucher B', tokenId: '12346' },
    },
  ];

  beforeEach(async () => {
    const mockPrismaService = {
      listingBatch: {
        findUnique: jest.fn(),
      },
      voucherCode: {
        findMany: jest.fn(),
      },
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetListingBatchDetailHandler,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    handler = module.get<GetListingBatchDetailHandler>(
      GetListingBatchDetailHandler,
    );
    prismaService = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should return batch detail with voucher types', async () => {
      prismaService.listingBatch.findUnique.mockResolvedValue(mockListingBatch);
      prismaService.voucherCode.findMany.mockResolvedValue(mockVoucherCodes);

      const result = await handler.execute('batch-123');

      expect(result.id).toBe('batch-123');
      expect(result.voucherTypes).toHaveLength(2); // 2 unique voucher types
      expect(result.remainingItems).toBe(7); // 10 - 3
    });

    it('should throw NotFoundException when batch not found', async () => {
      prismaService.listingBatch.findUnique.mockResolvedValue(null);

      await expect(handler.execute('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should correctly calculate sold and remaining amounts per voucher type', async () => {
      prismaService.listingBatch.findUnique.mockResolvedValue(mockListingBatch);
      prismaService.voucherCode.findMany.mockResolvedValue(mockVoucherCodes);

      const result = await handler.execute('batch-123');

      // voucher-1 has 2 codes, 1 sold
      const voucherA = result.voucherTypes.find(
        (vt) => vt.voucherId === 'voucher-1',
      );
      expect(voucherA?.totalAmount).toBe(2);
      expect(voucherA?.soldAmount).toBe(1);
      expect(voucherA?.remainingAmount).toBe(1);

      // voucher-2 has 1 code, 0 sold
      const voucherB = result.voucherTypes.find(
        (vt) => vt.voucherId === 'voucher-2',
      );
      expect(voucherB?.totalAmount).toBe(1);
      expect(voucherB?.soldAmount).toBe(0);
      expect(voucherB?.remainingAmount).toBe(1);
    });

    it('should group by voucherId and voucherGroupId', async () => {
      // Add another code with same voucherId but different voucherGroupId
      const codesWithDifferentListings = [
        ...mockVoucherCodes,
        {
          id: 'code-4',
          voucherId: 'voucher-1',
          voucherGroupId: 'listing-101', // Different listing
          pointsCost: 150,
          currency: 'THB',
          currentOwnerId: null,
          voucher: { id: 'voucher-1', name: 'Voucher A', tokenId: '12345' },
        },
      ];

      prismaService.listingBatch.findUnique.mockResolvedValue(mockListingBatch);
      prismaService.voucherCode.findMany.mockResolvedValue(
        codesWithDifferentListings,
      );

      const result = await handler.execute('batch-123');

      // Should have 3 groups: voucher-1/listing-100, voucher-1/listing-101, voucher-2/listing-200
      expect(result.voucherTypes).toHaveLength(3);
    });

    it('should return empty voucherTypes when batch has no codes', async () => {
      prismaService.listingBatch.findUnique.mockResolvedValue(mockListingBatch);
      prismaService.voucherCode.findMany.mockResolvedValue([]);

      const result = await handler.execute('batch-123');

      expect(result.voucherTypes).toHaveLength(0);
    });

    it('should include correct batch metadata', async () => {
      prismaService.listingBatch.findUnique.mockResolvedValue(mockListingBatch);
      prismaService.voucherCode.findMany.mockResolvedValue([]);

      const result = await handler.execute('batch-123');

      expect(result.name).toBe(mockListingBatch.name);
      expect(result.description).toBe(mockListingBatch.description);
      expect(result.sellerWalletAddress).toBe(
        mockListingBatch.sellerWalletAddress,
      );
      expect(result.totalItems).toBe(mockListingBatch.totalItems);
      expect(result.soldItems).toBe(mockListingBatch.soldItems);
      expect(result.totalValue).toBe(mockListingBatch.totalValue);
      expect(result.currency).toBe(mockListingBatch.currency);
      expect(result.status).toBe(mockListingBatch.status);
    });
  });
});
