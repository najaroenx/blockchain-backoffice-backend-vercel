import { Test, TestingModule } from '@nestjs/testing';
import { GetPointsByMerchantId } from '../src/modules/internal/point/handlers/getPointsByMerchantId.handler';
import { PointDBService } from '../src/modules/internal/point/services/point-db.service';
import { BlockchainService } from '../src/providers/blockchain/blockchain.service';
import { PrismaService } from '../prisma/prisma.service';
import { InternalServerErrorException } from '@nestjs/common';

describe('GetPointsByMerchantId', () => {
  let handler: GetPointsByMerchantId;

  const mockPointDBService = {
    getPointsByMerchant: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetPointsByMerchantId,
        {
          provide: PointDBService,
          useValue: mockPointDBService,
        },
        {
          provide: BlockchainService,
          useValue: { getBalance: jest.fn() },
        },
        {
          provide: PrismaService,
          useValue: {
            $queryRaw: jest.fn(),
            merchant: { findUnique: jest.fn() },
          },
        },
      ],
    }).compile();

    handler = module.get<GetPointsByMerchantId>(GetPointsByMerchantId);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should return points for a merchant successfully', async () => {
    const merchantId = 'merchant-123';
    const query = {};
    const mockResult = {
      points: [
        {
          id: '1',
          name: 'Point 1',
          contractAddress: Buffer.from(
            '1234567890abcdef1234567890abcdef12345678',
            'hex',
          ),
          merchantId: merchantId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '2',
          name: 'Point 2',
          contractAddress: Buffer.from(
            'abcdef1234567890abcdef1234567890abcdef12',
            'hex',
          ),
          merchantId: merchantId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      total: 2,
    };

    mockPointDBService.getPointsByMerchant.mockResolvedValue(mockResult);

    const result = await handler.execute(merchantId, query);

    expect(result).toBeDefined();
    expect(result.points).toBeDefined();
    expect(result.counts).toBe(2);
    expect(result.points.length).toBe(2);
    expect(mockPointDBService.getPointsByMerchant).toHaveBeenCalledWith(
      merchantId,
      expect.objectContaining({
        skip: undefined,
        take: undefined,
        orderBy: undefined,
      }),
    );
  });

  it('should return empty array when no points found', async () => {
    const merchantId = 'merchant-without-points';
    const query = {};

    mockPointDBService.getPointsByMerchant.mockResolvedValue({
      points: [],
      total: 0,
    });

    const result = await handler.execute(merchantId, query);

    expect(result).toBeDefined();
    expect(result.points).toEqual([]);
    expect(result.counts).toBe(0);
    expect(mockPointDBService.getPointsByMerchant).toHaveBeenCalledWith(
      merchantId,
      expect.objectContaining({
        skip: undefined,
        take: undefined,
        orderBy: undefined,
      }),
    );
  });

  it('should throw InternalServerErrorException on error', async () => {
    const merchantId = 'merchant-123';
    const query = {};

    mockPointDBService.getPointsByMerchant.mockRejectedValue(
      new Error('Database error'),
    );

    await expect(handler.execute(merchantId, query)).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
