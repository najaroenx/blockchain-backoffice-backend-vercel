jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { UpdatePointContractAddress } from 'src/modules/internal/admin/handlers/update-point-contract-address.handler';

describe('UpdatePointContractAddress', () => {
  let handler: UpdatePointContractAddress;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      point: {
        update: jest.fn(),
      },
    };

    handler = new UpdatePointContractAddress(prisma);
  });

  it('should update point contractAddress and return formatted address', async () => {
    prisma.point.update.mockResolvedValue({
      id: 'point-1',
      contractAddress: Buffer.from('1234abcd', 'hex'),
      name: 'Demo Point',
    });

    const result = await handler.execute('point-1', '0x1234abcd');

    expect(prisma.point.update).toHaveBeenCalledWith({
      where: { id: 'point-1' },
      data: {
        contractAddress: Buffer.from('1234abcd', 'hex'),
      },
    });
    expect(result).toEqual({
      success: true,
      message: 'Point contractAddress updated successfully',
      point: {
        id: 'point-1',
        contractAddress: '0x1234abcd',
        name: 'Demo Point',
      },
    });
  });

  it('should throw BadRequestException for invalid contractAddress', async () => {
    await expect(
      handler.execute('point-1', 'invalid-address'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.point.update).not.toHaveBeenCalled();
  });

  it('should throw NotFoundException when point does not exist', async () => {
    prisma.point.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('not found', {
        code: 'P2025',
        clientVersion: 'test',
      }),
    );

    await expect(
      handler.execute('point-1', '0x1234abcd'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('should throw InternalServerErrorException on unexpected failure', async () => {
    prisma.point.update.mockRejectedValue(new Error('db error'));

    await expect(
      handler.execute('point-1', '0x1234abcd'),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });
});
