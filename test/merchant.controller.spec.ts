jest.mock('prisma/prisma.service', () => ({ PrismaService: jest.fn() }));

import { Test, TestingModule } from '@nestjs/testing';
import { MerchantController } from 'src/modules/internal/merchant/controllers/merchant.controller';
import { GetMerchants } from 'src/modules/internal/merchant/handlers/getMerchants.handler';
import { CreateMerchant } from 'src/modules/internal/merchant/handlers/createMerchant.handler';
import { UpdateMerchant } from 'src/modules/internal/merchant/handlers/updateMerchant.handler';
import { GetMerchant } from 'src/modules/internal/merchant/handlers/getMerchantById.handler';
import { DeleteMerchant } from 'src/modules/internal/merchant/handlers/deleteMerchant.handler';
import { GetMerchantDashboardStats } from 'src/modules/internal/merchant/handlers/getMerchantDashboardStats.handler';
import { MerchantDBService } from 'src/modules/internal/merchant/services/merchant-db.service';

describe('MerchantController', () => {
  let controller: MerchantController;
  let getMerchantsHandler: jest.Mocked<GetMerchants>;
  let createMerchantHandler: jest.Mocked<CreateMerchant>;
  let updateMerchantHandler: jest.Mocked<UpdateMerchant>;
  let getMerchantHandler: jest.Mocked<GetMerchant>;
  let deleteMerchantHandler: jest.Mocked<DeleteMerchant>;
  let getMerchantDashboardStatsHandler: jest.Mocked<GetMerchantDashboardStats>;
  let merchantDBService: jest.Mocked<MerchantDBService>;

  beforeEach(async () => {
    getMerchantsHandler = { execute: jest.fn() } as any;
    createMerchantHandler = { execute: jest.fn() } as any;
    updateMerchantHandler = { execute: jest.fn() } as any;
    getMerchantHandler = { execute: jest.fn() } as any;
    deleteMerchantHandler = { execute: jest.fn() } as any;
    getMerchantDashboardStatsHandler = { execute: jest.fn() } as any;
    merchantDBService = { getAllMerchants: jest.fn() } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MerchantController],
      providers: [
        { provide: GetMerchants, useValue: getMerchantsHandler },
        { provide: CreateMerchant, useValue: createMerchantHandler },
        { provide: UpdateMerchant, useValue: updateMerchantHandler },
        { provide: GetMerchant, useValue: getMerchantHandler },
        { provide: DeleteMerchant, useValue: deleteMerchantHandler },
        {
          provide: GetMerchantDashboardStats,
          useValue: getMerchantDashboardStatsHandler,
        },
        { provide: MerchantDBService, useValue: merchantDBService },
      ],
    }).compile();

    controller = module.get<MerchantController>(MerchantController);
  });

  it('getMerchants delegates to handler.getListMerchants', async () => {
    const mockResponse = { merchants: [{ id: 'm1' }], counts: 1 };
    (getMerchantsHandler as any).getListMerchants = jest.fn().mockResolvedValue(mockResponse);
    const result = await controller.getMerchants();
    expect((getMerchantsHandler as any).getListMerchants).toHaveBeenCalled();
    expect(result).toEqual(mockResponse);
  });

  it('getAllMerchants delegates to merchantDBService', async () => {
    const filters = { page: 1, limit: 10 } as any;
    merchantDBService.getAllMerchants.mockResolvedValue({ data: [] } as any);
    const result = await controller.getAllMerchants(filters);
    expect(merchantDBService.getAllMerchants).toHaveBeenCalledWith(filters);
    expect(result).toEqual({ data: [] });
  });

  it('createMerchant extracts body fields and delegates to handler', async () => {
    const body = {
      userId: 'u1',
      name: 'Shop',
      website: 'web',
      tel: '123',
    } as any;
    createMerchantHandler.execute.mockResolvedValue({ id: 'm1' } as any);
    const result = await controller.createMerchant(body);
    expect(createMerchantHandler.execute).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ name: 'Shop' }),
    );
    expect(result).toEqual({ id: 'm1' });
  });

  it('update delegates to handler with merchantId and data', async () => {
    const data = { name: 'New name' } as any;
    updateMerchantHandler.execute.mockResolvedValue({ id: 'm1' } as any);
    const result = await controller.update(data, 'm1');
    expect(updateMerchantHandler.execute).toHaveBeenCalledWith('m1', data);
    expect(result).toEqual({ id: 'm1' });
  });

  it('getDashboardStats delegates to handler', async () => {
    getMerchantDashboardStatsHandler.execute.mockResolvedValue({
      stats: true,
    } as any);
    const result = await controller.getDashboardStats('m1');
    expect(getMerchantDashboardStatsHandler.execute).toHaveBeenCalledWith('m1');
    expect(result).toEqual({ stats: true });
  });

  it('getMerchant delegates to handler', async () => {
    getMerchantHandler.execute.mockResolvedValue({ id: 'm1' } as any);
    const result = await controller.getMerchant('m1');
    expect(getMerchantHandler.execute).toHaveBeenCalledWith('m1');
    expect(result).toEqual({ id: 'm1' });
  });

  it('deleteMerchant delegates to handler', async () => {
    deleteMerchantHandler.execute.mockResolvedValue({ deleted: true });
    const result = await controller.deleteMerchant('m1');
    expect(deleteMerchantHandler.execute).toHaveBeenCalledWith('m1');
    expect(result).toEqual({ deleted: true });
  });
});
