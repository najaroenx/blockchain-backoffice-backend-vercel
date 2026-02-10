jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));
import {
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { DeletePoint } from 'src/modules/internal/point/handlers/deletePoint.handler';
import { PointDBService } from 'src/modules/internal/point/services/point-db.service';

describe('DeletePoint', () => {
  let handler: DeletePoint;
  let dbService: jest.Mocked<PointDBService>;

  beforeEach(() => {
    dbService = {
      getPointById: jest.fn(),
      deletePoint: jest.fn(),
    } as any;

    handler = new DeletePoint(dbService);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should delete point successfully', async () => {
    const id = 'p-123';
    const merchantId = 'm-1';
    const fakePoint = { id, merchantId, name: 'My Point' } as any;

    dbService.getPointById.mockResolvedValue(fakePoint);
    dbService.deletePoint.mockResolvedValue(fakePoint);

    const result = await handler.execute(id, merchantId);

    expect(dbService.getPointById).toHaveBeenCalledWith(id, merchantId);
    expect(dbService.deletePoint).toHaveBeenCalledWith(id, merchantId);
    expect(result).toEqual(fakePoint);
  });

  it('should throw NotFoundException when point not found', async () => {
    dbService.getPointById.mockResolvedValue(null);

    await expect(handler.execute('p-1', 'm-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should throw InternalServerErrorException on unknown error', async () => {
    dbService.getPointById.mockResolvedValue({ id: 'p-1' } as any);
    dbService.deletePoint.mockRejectedValue(new Error('DB failed'));

    await expect(handler.execute('p-1', 'm-1')).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
