jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import { InternalServerErrorException } from '@nestjs/common';
import { ListAllPoints } from 'src/modules/internal/admin/handlers/list-all-points.handler';

describe('ListAllPoints', () => {
  let handler: ListAllPoints;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      point: {
        findMany: jest.fn(),
      },
    };

    handler = new ListAllPoints(prisma);
  });

  it('should return all point records with count', async () => {
    prisma.point.findMany.mockResolvedValue([
      {
        id: 'point-1',
        name: 'Point A',
        contractAddress: Buffer.from('1234abcd', 'hex'),
      },
      {
        id: 'point-2',
        name: 'Point B',
        contractAddress: Buffer.from('5678ef90', 'hex'),
      },
    ]);

    const result = await handler.execute();

    expect(prisma.point.findMany).toHaveBeenCalledWith({
      orderBy: {
        createdAt: 'desc',
      },
    });
    expect(result).toEqual({
      points: [
        {
          id: 'point-1',
          name: 'Point A',
          contractAddress: '0x1234abcd',
        },
        {
          id: 'point-2',
          name: 'Point B',
          contractAddress: '0x5678ef90',
        },
      ],
      counts: 2,
    });
  });

  it('should throw InternalServerErrorException on query failure', async () => {
    prisma.point.findMany.mockRejectedValue(new Error('db error'));

    await expect(handler.execute()).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });
});
