jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));
import {
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { GetPointByPhone } from 'src/modules/internal/point/handlers/getPointByPhone.handler';
import { PointDBService } from 'src/modules/internal/point/services/point-db.service';

describe('GetPointByPhone', () => {
  let handler: GetPointByPhone;
  let db: jest.Mocked<PointDBService>;

  beforeEach(() => {
    db = { getPointByPhone: jest.fn() } as any;
    handler = new GetPointByPhone(db);
    jest.clearAllMocks();
  });

  it('should return customer points', async () => {
    const mockResult = {
      phone: '0812345678',
      customerId: 'c-1',
      points: [{ pointId: 'p-1', name: 'Test Point', balance: 100 }],
    };
    db.getPointByPhone.mockResolvedValue(mockResult);

    const result = await handler.execute('0812345678');

    expect(db.getPointByPhone).toHaveBeenCalledWith('0812345678');
    expect(result.customerPoints).toEqual(mockResult);
  });

  it('should throw NotFoundException when point is null', async () => {
    db.getPointByPhone.mockResolvedValue(null);

    await expect(handler.execute('0000000000')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should throw InternalServerErrorException on unexpected error', async () => {
    db.getPointByPhone.mockRejectedValue(new Error('DB failed'));

    await expect(handler.execute('0812345678')).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
