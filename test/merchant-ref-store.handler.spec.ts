jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CreateMerchantRefStoreHandler } from 'src/modules/internal/dashboard/handlers/merchant-ref-store/create-merchant-ref-store.handler';
import { UpdateMerchantRefStoreHandler } from 'src/modules/internal/dashboard/handlers/merchant-ref-store/update-merchant-ref-store.handler';
import { DeleteMerchantRefStoreHandler } from 'src/modules/internal/dashboard/handlers/merchant-ref-store/delete-merchant-ref-store.handler';
import {
  ListMerchantRefStoreHandler,
  GetMerchantRefStoreByIdHandler,
  GetMerchantRefStoreByRefHandler,
} from 'src/modules/internal/dashboard/handlers/merchant-ref-store/list-merchant-ref-store.handler';

describe('MerchantRefStore Handlers', () => {
  let prisma: any;

  const mockStore = {
    id: 'mrs-1',
    merchantRef: 'REF001',
    name: 'Store One',
    category: 'Food',
    description: 'A food store',
    imageUrl: null,
    locationUrl: null,
    website: 'https://store.com',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    prisma = {
      merchantRefStore: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
    };
    jest.clearAllMocks();
  });

  describe('CreateMerchantRefStoreHandler', () => {
    let handler: CreateMerchantRefStoreHandler;

    beforeEach(() => {
      handler = new CreateMerchantRefStoreHandler(prisma);
    });

    it('should create a new merchant ref store', async () => {
      prisma.merchantRefStore.findUnique.mockResolvedValue(null);
      prisma.merchantRefStore.create.mockResolvedValue(mockStore);

      const result = await handler.execute({
        merchantRef: 'REF001',
        name: 'Store One',
        category: 'Food',
      } as any);

      expect(result).toEqual(mockStore);
      expect(prisma.merchantRefStore.create).toHaveBeenCalled();
    });

    it('should throw ConflictException when merchantRef already exists', async () => {
      prisma.merchantRefStore.findUnique.mockResolvedValue(mockStore);

      await expect(
        handler.execute({ merchantRef: 'REF001', name: 'Store' } as any),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('UpdateMerchantRefStoreHandler', () => {
    let handler: UpdateMerchantRefStoreHandler;

    beforeEach(() => {
      handler = new UpdateMerchantRefStoreHandler(prisma);
    });

    it('should update an existing store', async () => {
      prisma.merchantRefStore.findUnique.mockResolvedValue(mockStore);
      const updated = { ...mockStore, name: 'Updated Store' };
      prisma.merchantRefStore.update.mockResolvedValue(updated);

      const result = await handler.execute('mrs-1', {
        name: 'Updated Store',
      } as any);

      expect(result.name).toBe('Updated Store');
    });

    it('should throw NotFoundException when store not found', async () => {
      prisma.merchantRefStore.findUnique.mockResolvedValue(null);

      await expect(
        handler.execute('nonexistent', { name: 'New' } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException when updating to duplicate merchantRef', async () => {
      prisma.merchantRefStore.findUnique
        .mockResolvedValueOnce(mockStore) // existing check
        .mockResolvedValueOnce({ id: 'mrs-2' }); // duplicate check

      await expect(
        handler.execute('mrs-1', { merchantRef: 'REF002' } as any),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('DeleteMerchantRefStoreHandler', () => {
    let handler: DeleteMerchantRefStoreHandler;

    beforeEach(() => {
      handler = new DeleteMerchantRefStoreHandler(prisma);
    });

    it('should soft delete (set isActive = false)', async () => {
      prisma.merchantRefStore.findUnique.mockResolvedValue(mockStore);
      prisma.merchantRefStore.update.mockResolvedValue({
        ...mockStore,
        isActive: false,
      });

      const result = await handler.execute('mrs-1');

      expect(result.isActive).toBe(false);
      expect(prisma.merchantRefStore.update).toHaveBeenCalledWith({
        where: { id: 'mrs-1' },
        data: { isActive: false },
      });
    });

    it('should throw NotFoundException on soft delete when not found', async () => {
      prisma.merchantRefStore.findUnique.mockResolvedValue(null);

      await expect(handler.execute('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should hard delete from database', async () => {
      prisma.merchantRefStore.findUnique.mockResolvedValue(mockStore);
      prisma.merchantRefStore.delete.mockResolvedValue(undefined);

      await handler.hardDelete('mrs-1');

      expect(prisma.merchantRefStore.delete).toHaveBeenCalledWith({
        where: { id: 'mrs-1' },
      });
    });

    it('should throw NotFoundException on hard delete when not found', async () => {
      prisma.merchantRefStore.findUnique.mockResolvedValue(null);

      await expect(handler.hardDelete('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('ListMerchantRefStoreHandler', () => {
    let handler: ListMerchantRefStoreHandler;

    beforeEach(() => {
      handler = new ListMerchantRefStoreHandler(prisma);
    });

    it('should return paginated results', async () => {
      prisma.merchantRefStore.count.mockResolvedValue(1);
      prisma.merchantRefStore.findMany.mockResolvedValue([mockStore]);

      const result = await handler.execute({ page: 1, limit: 10 } as any);

      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.page).toBe(1);
    });

    it('should apply filters', async () => {
      prisma.merchantRefStore.count.mockResolvedValue(0);
      prisma.merchantRefStore.findMany.mockResolvedValue([]);

      await handler.execute({
        name: 'Test',
        category: 'Food',
        isActive: true,
        merchantRef: 'REF',
      } as any);

      expect(prisma.merchantRefStore.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: 'Food',
            isActive: true,
          }),
        }),
      );
    });

    it('should return empty with correct pagination when no results', async () => {
      prisma.merchantRefStore.count.mockResolvedValue(0);
      prisma.merchantRefStore.findMany.mockResolvedValue([]);

      const result = await handler.execute({} as any);

      expect(result.data).toEqual([]);
      expect(result.pagination.totalPages).toBe(0);
    });
  });

  describe('GetMerchantRefStoreByIdHandler', () => {
    let handler: GetMerchantRefStoreByIdHandler;

    beforeEach(() => {
      handler = new GetMerchantRefStoreByIdHandler(prisma);
    });

    it('should return store by merchantRef', async () => {
      prisma.merchantRefStore.findUnique.mockResolvedValue(mockStore);

      const result = await handler.execute('REF001');

      expect(result).toEqual(mockStore);
      expect(prisma.merchantRefStore.findUnique).toHaveBeenCalledWith({
        where: { merchantRef: 'REF001' },
      });
    });

    it('should throw NotFoundException when not found', async () => {
      prisma.merchantRefStore.findUnique.mockResolvedValue(null);

      await expect(handler.execute('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('GetMerchantRefStoreByRefHandler', () => {
    let handler: GetMerchantRefStoreByRefHandler;

    beforeEach(() => {
      handler = new GetMerchantRefStoreByRefHandler(prisma);
    });

    it('should return store by merchantRef', async () => {
      prisma.merchantRefStore.findUnique.mockResolvedValue(mockStore);

      const result = await handler.execute('REF001');

      expect(result).toEqual(mockStore);
    });

    it('should throw NotFoundException when not found', async () => {
      prisma.merchantRefStore.findUnique.mockResolvedValue(null);

      await expect(handler.execute('NONEXISTENT')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
