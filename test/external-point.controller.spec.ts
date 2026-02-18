jest.mock('prisma/prisma.service', () => ({ PrismaService: jest.fn() }));

import { Test, TestingModule } from '@nestjs/testing';
import { ExternalPointController } from 'src/modules/external/controllers/external-point.controller';
import { PointDBService } from 'src/modules/internal/point/services/point-db.service';
import { GetPointById } from 'src/modules/internal/point/handlers/getPointById.handler';
import { GetPointByPhone } from 'src/modules/internal/point/handlers/getPointByPhone.handler';

describe('ExternalPointController', () => {
  let controller: ExternalPointController;
  let pointDBService: jest.Mocked<PointDBService>;
  let getPointById: jest.Mocked<GetPointById>;
  let getPointByPhone: jest.Mocked<GetPointByPhone>;

  beforeEach(async () => {
    pointDBService = { getAllPoints: jest.fn() } as any;
    getPointById = { execute: jest.fn() } as any;
    getPointByPhone = { execute: jest.fn() } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExternalPointController],
      providers: [
        { provide: PointDBService, useValue: pointDBService },
        { provide: GetPointById, useValue: getPointById },
        { provide: GetPointByPhone, useValue: getPointByPhone },
      ],
    }).compile();

    controller = module.get<ExternalPointController>(ExternalPointController);
  });

  it('getAllPoints delegates to pointDBService', async () => {
    const filters = { page: 1, limit: 10 } as any;
    pointDBService.getAllPoints.mockResolvedValue({ data: [] } as any);
    const result = await controller.getAllPoints(filters);
    expect(pointDBService.getAllPoints).toHaveBeenCalledWith(filters);
    expect(result).toEqual({ data: [] });
  });

  it('getPointsByPhone delegates to handler', async () => {
    getPointByPhone.execute.mockResolvedValue({ points: [] } as any);
    const result = await controller.getPointsByPhone('0812345678');
    expect(getPointByPhone.execute).toHaveBeenCalledWith('0812345678');
    expect(result).toEqual({ points: [] });
  });

  it('getPointById delegates to handler', async () => {
    getPointById.execute.mockResolvedValue({ id: 'p1' } as any);
    const result = await controller.getPointById({ pointId: 'p1' } as any);
    expect(getPointById.execute).toHaveBeenCalledWith('p1');
    expect(result).toEqual({ id: 'p1' });
  });
});
