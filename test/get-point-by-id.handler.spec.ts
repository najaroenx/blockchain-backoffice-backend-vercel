jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));
import {
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { GetPointById } from 'src/modules/point/handlers/getPointById.handler';
import { PointDBService } from 'src/modules/point/services/point-db.service';
import { convertBufferToAddress } from 'src/libs/convertBufferToAddress';
// import { POINT_NOT_FOUND } from 'src/errors/error.constants';

// Mock convertBufferToAddress เพื่อไม่เรียกจริง
jest.mock('src/libs/convertBufferToAddress', () => ({
  convertBufferToAddress: jest.fn().mockReturnValue('0xMOCKED_ADDRESS'),
}));

describe('GetPointById', () => {
  let handler: GetPointById;
  let dbService: jest.Mocked<PointDBService>;

  beforeEach(() => {
    dbService = {
      getPointById: jest.fn(),
    } as any;

    handler = new GetPointById(dbService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should return point data with converted address', async () => {
    const pointId = 'p1';
    const merchantId = 'm1';
    const fakeBuffer = Buffer.from('0xABCDEF');
    const fakePoint = {
      id: pointId,
      merchantId,
      contractAddress: fakeBuffer,
      name: 'Reward',
    } as any;

    dbService.getPointById.mockResolvedValue(fakePoint);

    const result = await handler.execute(pointId, merchantId);

    expect(dbService.getPointById).toHaveBeenCalledWith(pointId, merchantId);
    expect(convertBufferToAddress).toHaveBeenCalledWith(fakeBuffer);
    expect(result).toEqual({
      point: {
        ...fakePoint,
        contractAddress: '0xMOCKED_ADDRESS',
      },
    });
  });

  it('should throw NotFoundException when point not found', async () => {
    dbService.getPointById.mockResolvedValue(null);

    await expect(handler.execute('p1', 'm1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should throw InternalServerErrorException on unexpected error', async () => {
    dbService.getPointById.mockRejectedValue(new Error('DB failed'));

    await expect(handler.execute('p1', 'm1')).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
