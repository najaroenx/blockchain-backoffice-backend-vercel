import { Test, TestingModule } from '@nestjs/testing';
import { UpdatePoint } from '../src/modules/point/handlers/updatePoint.handler';
import { PointDBService } from '../src/modules/point/services/point-db.service';
import {
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

describe('UpdatePoint', () => {
  let handler: UpdatePoint;

  const mockPointDBService = {
    updatePoint: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdatePoint,
        {
          provide: PointDBService,
          useValue: mockPointDBService,
        },
      ],
    }).compile();

    handler = module.get<UpdatePoint>(UpdatePoint);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should update point successfully', async () => {
    const pointId = '1';
    const updateData = {
      name: 'Test Point',
      contractAddress: '0x1234567890abcdef1234567890abcdef12345678',
    };

    const mockPoint = {
      id: pointId,
      name: 'Test Point',
      contractAddress: Buffer.from(
        '1234567890abcdef1234567890abcdef12345678',
        'hex',
      ),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockPointDBService.updatePoint.mockResolvedValue(mockPoint);

    const result = await handler.execute(pointId, updateData);

    expect(result).toBeDefined();
    expect(result.point).toBeDefined();
    expect(result.point.name).toBe('Test Point');
    expect(mockPointDBService.updatePoint).toHaveBeenCalledWith(pointId, {
      name: 'Test Point',
      contractAddress: Buffer.from(
        '1234567890abcdef1234567890abcdef12345678',
        'hex',
      ),
    });
  });

  it('should throw NotFoundException when point not found', async () => {
    const pointId = 'non-existent-id';
    const updateData = {
      name: 'Test Point',
      contractAddress: '0x1234567890abcdef1234567890abcdef12345678',
    };

    const prismaError = new Prisma.PrismaClientKnownRequestError(
      'Record not found',
      {
        code: 'P2025',
        clientVersion: '4.0.0',
      },
    );

    mockPointDBService.updatePoint.mockRejectedValue(prismaError);

    await expect(handler.execute(pointId, updateData)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should throw InternalServerErrorException for other errors', async () => {
    const pointId = '1';
    const updateData = {
      name: 'Test Point',
      contractAddress: '0x1234567890abcdef1234567890abcdef12345678',
    };

    mockPointDBService.updatePoint.mockRejectedValue(
      new Error('Unknown error'),
    );

    await expect(handler.execute(pointId, updateData)).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
