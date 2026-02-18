jest.mock('prisma/prisma.service', () => ({ PrismaService: jest.fn() }));

import { Test, TestingModule } from '@nestjs/testing';
import { PointController } from 'src/modules/internal/point/controllers/point.controller';
import { GetPointsByMerchantId } from 'src/modules/internal/point/handlers/getPointsByMerchantId.handler';
import { UpdatePoint } from 'src/modules/internal/point/handlers/updatePoint.handler';
import { CreatePoint } from 'src/modules/internal/point/handlers/createPoint.handler';
import { DeletePoint } from 'src/modules/internal/point/handlers/deletePoint.handler';

describe('PointController', () => {
  let controller: PointController;
  let getPointsByMerchantId: jest.Mocked<GetPointsByMerchantId>;
  let updatePoint: jest.Mocked<UpdatePoint>;
  let createPoint: jest.Mocked<CreatePoint>;
  let deletePoint: jest.Mocked<DeletePoint>;

  beforeEach(async () => {
    getPointsByMerchantId = { execute: jest.fn() } as any;
    updatePoint = { execute: jest.fn() } as any;
    createPoint = { execute: jest.fn() } as any;
    deletePoint = { execute: jest.fn() } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PointController],
      providers: [
        { provide: GetPointsByMerchantId, useValue: getPointsByMerchantId },
        { provide: UpdatePoint, useValue: updatePoint },
        { provide: CreatePoint, useValue: createPoint },
        { provide: DeletePoint, useValue: deletePoint },
      ],
    }).compile();

    controller = module.get<PointController>(PointController);
  });

  it('getPointsByMerchant delegates to handler', async () => {
    getPointsByMerchantId.execute.mockResolvedValue([{ id: 'p1' }] as any);
    const result = await controller.getPointsByMerchant('m1', {});
    expect(getPointsByMerchantId.execute).toHaveBeenCalledWith('m1', {});
    expect(result).toEqual([{ id: 'p1' }]);
  });

  it('createPoint delegates to handler', async () => {
    const data = { name: 'Loyalty' } as any;
    createPoint.execute.mockResolvedValue({ id: 'p1' } as any);
    const result = await controller.createPoint('m1', data);
    expect(createPoint.execute).toHaveBeenCalledWith('m1', data);
    expect(result).toEqual({ id: 'p1' });
  });

  it('update converts Unix timestamps and delegates to handler', async () => {
    const data = {
      name: 'Updated',
      startDate: 1700000000,
      endDate: 1700100000,
    } as any;
    updatePoint.execute.mockResolvedValue({ id: 'p1' } as any);
    const result = await controller.update(data, 'p1');
    expect(updatePoint.execute).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({
        name: 'Updated',
        startDate: new Date(1700000000 * 1000),
        endDate: new Date(1700100000 * 1000),
      }),
    );
    expect(result).toEqual({ id: 'p1' });
  });

  it('update without dates passes data as-is', async () => {
    const data = { name: 'Updated' } as any;
    updatePoint.execute.mockResolvedValue({ id: 'p1' } as any);
    await controller.update(data, 'p1');
    expect(updatePoint.execute).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({ name: 'Updated' }),
    );
  });

  it('deletePoint delegates to handler with id and merchantId', async () => {
    deletePoint.execute.mockResolvedValue({ deleted: true } as any);
    const result = await controller.deletePoint({
      merchantId: 'm1',
      id: 'p1',
    } as any);
    expect(deletePoint.execute).toHaveBeenCalledWith('p1', 'm1');
    expect(result).toEqual({ deleted: true });
  });
});
