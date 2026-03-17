jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { MerchantRefStoreController } from 'src/modules/internal/dashboard/controllers/merchant-ref-store.controller';
import {
  ListMerchantRefStoreHandler,
  GetMerchantRefStoreByIdHandler,
  GetMerchantRefStoreByRefHandler,
} from 'src/modules/internal/dashboard/handlers/merchant-ref-store/list-merchant-ref-store.handler';
import { CreateMerchantRefStoreHandler } from 'src/modules/internal/dashboard/handlers/merchant-ref-store/create-merchant-ref-store.handler';
import { UpdateMerchantRefStoreHandler } from 'src/modules/internal/dashboard/handlers/merchant-ref-store/update-merchant-ref-store.handler';
import { DeleteMerchantRefStoreHandler } from 'src/modules/internal/dashboard/handlers/merchant-ref-store/delete-merchant-ref-store.handler';

describe('MerchantRefStoreController', () => {
  let controller: MerchantRefStoreController;
  let mockListHandler: any;
  let mockGetByIdHandler: any;
  let mockGetByRefHandler: any;
  let mockCreateHandler: any;
  let mockUpdateHandler: any;
  let mockDeleteHandler: any;

  const sampleStore = {
    id: 'store-1',
    merchantRef: 'ref-001',
    name: 'Test Store',
    category: 'food',
    description: 'Test description',
    imageUrl: null,
    locationUrl: null,
    website: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    mockListHandler = { execute: jest.fn() };
    mockGetByIdHandler = { execute: jest.fn() };
    mockGetByRefHandler = { execute: jest.fn() };
    mockCreateHandler = { execute: jest.fn() };
    mockUpdateHandler = { execute: jest.fn() };
    mockDeleteHandler = { execute: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MerchantRefStoreController],
      providers: [
        { provide: ListMerchantRefStoreHandler, useValue: mockListHandler },
        {
          provide: GetMerchantRefStoreByIdHandler,
          useValue: mockGetByIdHandler,
        },
        {
          provide: GetMerchantRefStoreByRefHandler,
          useValue: mockGetByRefHandler,
        },
        { provide: CreateMerchantRefStoreHandler, useValue: mockCreateHandler },
        { provide: UpdateMerchantRefStoreHandler, useValue: mockUpdateHandler },
        { provide: DeleteMerchantRefStoreHandler, useValue: mockDeleteHandler },
      ],
    }).compile();

    controller = module.get<MerchantRefStoreController>(
      MerchantRefStoreController,
    );
  });

  it('should list merchant ref stores', async () => {
    const paginatedResponse = {
      data: [sampleStore],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    };
    mockListHandler.execute.mockResolvedValue(paginatedResponse);

    const result = await controller.list({ page: 1, limit: 20 } as any);
    expect(result).toEqual(paginatedResponse);
    expect(mockListHandler.execute).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
    });
  });

  it('should get store by merchantRef from canonical route', async () => {
    mockGetByIdHandler.execute.mockResolvedValue(sampleStore);

    const result = await controller.getByMerchantRef('ref-001');
    expect(result).toEqual(sampleStore);
    expect(mockGetByIdHandler.execute).toHaveBeenCalledWith('ref-001');
  });

  it('should get store by merchantRef', async () => {
    mockGetByRefHandler.execute.mockResolvedValue(sampleStore);

    const result = await controller.getByRef('ref-001');
    expect(result).toEqual(sampleStore);
    expect(mockGetByRefHandler.execute).toHaveBeenCalledWith('ref-001');
  });

  it('should create new store', async () => {
    mockCreateHandler.execute.mockResolvedValue(sampleStore);
    const dto = { merchantRef: 'ref-001', name: 'Test Store' };

    const result = await controller.create(dto as any);
    expect(result).toEqual(sampleStore);
    expect(mockCreateHandler.execute).toHaveBeenCalledWith(dto);
  });

  it('should update store', async () => {
    const updated = { ...sampleStore, name: 'Updated Store' };
    mockUpdateHandler.execute.mockResolvedValue(updated);

    const result = await controller.update('store-1', {
      name: 'Updated Store',
    } as any);
    expect(result.name).toBe('Updated Store');
    expect(mockUpdateHandler.execute).toHaveBeenCalledWith('store-1', {
      name: 'Updated Store',
    });
  });

  it('should delete store', async () => {
    const deleted = { ...sampleStore, isActive: false };
    mockDeleteHandler.execute.mockResolvedValue(deleted);

    const result = await controller.delete('store-1');
    expect(result.isActive).toBe(false);
    expect(mockDeleteHandler.execute).toHaveBeenCalledWith('store-1');
  });
});
