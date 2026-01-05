import { Test, TestingModule } from '@nestjs/testing';
import { PointDBService } from '../src/modules/point/services/point-db.service';
import { PointRepository } from '../src/modules/point/point.repository';
import { Point, Prisma } from '@prisma/client';

describe('PointDBService', () => {
  let service: PointDBService;
  let repository: jest.Mocked<PointRepository>;

  const mockPoint: Point = {
    id: 'point-1',
    merchantId: 'merchant-1',
    name: 'Test Point',
    symbol: 'TST',
    decimal: 18,
    initialSupply: 1000000,
    contractAddress: Buffer.from(
      '0x1111111111111111111111111111111111111111',
      'hex',
    ),
    startDate: new Date(),
    endDate: new Date(Date.now() + 86400000),
    epochDuration: 259200,
    imageUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockRepository = {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PointDBService,
        {
          provide: PointRepository,
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<PointDBService>(PointDBService);
    repository = module.get(PointRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createPoint', () => {
    it('should create a new point successfully', async () => {
      const contractAddress = Buffer.from(
        '0x2222222222222222222222222222222222222222',
        'hex',
      );
      const createData: Omit<
        Omit<Prisma.PointCreateInput, 'contractAddress'>,
        'merchant'
      > = {
        name: 'New Point',
        symbol: 'NEW',
        decimal: 18,
        initialSupply: 5000000,
        startDate: new Date(),
        endDate: new Date(Date.now() + 86400000),
      };

      repository.create.mockResolvedValue(mockPoint);

      const result = await service.createPoint(
        'merchant-1',
        contractAddress,
        createData,
      );

      expect(result).toEqual(mockPoint);
      expect(repository.create).toHaveBeenCalledWith({
        data: {
          ...createData,
          contractAddress: new Uint8Array(contractAddress),
          merchantId: 'merchant-1',
        },
      });
    });

    it('should throw error if repository.create fails', async () => {
      const contractAddress = Buffer.from(
        '0x2222222222222222222222222222222222222222',
        'hex',
      );
      const createData: Omit<
        Omit<Prisma.PointCreateInput, 'contractAddress'>,
        'merchant'
      > = {
        name: 'New Point',
        symbol: 'NEW',
        decimal: 18,
        initialSupply: 5000000,
        startDate: new Date(),
        endDate: new Date(Date.now() + 86400000),
      };

      repository.create.mockRejectedValue(new Error('Database error'));

      await expect(
        service.createPoint('merchant-1', contractAddress, createData),
      ).rejects.toThrow('Database error');
    });
  });

  describe('getPointsByMerchant', () => {
    it('should return points for a merchant with default options', async () => {
      repository.findMany.mockResolvedValue([mockPoint]);
      repository.count.mockResolvedValue(1);

      const result = await service.getPointsByMerchant('merchant-1');

      expect(result.points).toEqual([mockPoint]);
      expect(result.total).toBe(1);
      expect(repository.findMany).toHaveBeenCalledWith({
        where: { merchantId: 'merchant-1' },
        skip: undefined,
        take: undefined,
        orderBy: undefined,
      });
    });

    it('should apply pagination options', async () => {
      repository.findMany.mockResolvedValue([mockPoint]);
      repository.count.mockResolvedValue(10);

      const result = await service.getPointsByMerchant('merchant-1', {
        skip: 5,
        take: 5,
      });

      expect(result.total).toBe(10);
      expect(repository.findMany).toHaveBeenCalledWith({
        where: { merchantId: 'merchant-1' },
        skip: 5,
        take: 5,
        orderBy: undefined,
      });
    });

    it('should apply orderBy option', async () => {
      repository.findMany.mockResolvedValue([mockPoint]);
      repository.count.mockResolvedValue(1);

      await service.getPointsByMerchant('merchant-1', {
        orderBy: { createdAt: 'desc' as const },
      });

      expect(repository.findMany).toHaveBeenCalledWith({
        where: { merchantId: 'merchant-1' },
        skip: undefined,
        take: undefined,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should apply custom where conditions', async () => {
      repository.findMany.mockResolvedValue([mockPoint]);
      repository.count.mockResolvedValue(1);

      await service.getPointsByMerchant('merchant-1', {
        where: { name: { contains: 'Test' } },
      });

      expect(repository.findMany).toHaveBeenCalledWith({
        where: {
          merchantId: 'merchant-1',
          name: { contains: 'Test' },
        },
        skip: undefined,
        take: undefined,
        orderBy: undefined,
      });
    });

    it('should return empty array when no points found', async () => {
      repository.findMany.mockResolvedValue([]);
      repository.count.mockResolvedValue(0);

      const result = await service.getPointsByMerchant('merchant-1');

      expect(result.points).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('getPointById', () => {
    it('should return point by ID without merchantId', async () => {
      repository.findFirst.mockResolvedValue(mockPoint);

      const result = await service.getPointById('point-1');

      // Service adds statistics field
      expect(result).toMatchObject({
        id: 'point-1',
        name: 'Test Point',
        symbol: 'TST',
      });
      expect(repository.findFirst).toHaveBeenCalledWith({
        where: { id: 'point-1' },
        include: expect.any(Object),
      });
    });

    it('should return point by ID with merchantId', async () => {
      repository.findFirst.mockResolvedValue(mockPoint);

      const result = await service.getPointById('point-1', 'merchant-1');

      // Service adds statistics field
      expect(result).toMatchObject({
        id: 'point-1',
        name: 'Test Point',
        symbol: 'TST',
      });
      expect(repository.findFirst).toHaveBeenCalledWith({
        where: { id: 'point-1', merchantId: 'merchant-1' },
        include: expect.any(Object),
      });
    });

    it('should return null when point not found', async () => {
      repository.findUnique.mockResolvedValue(null);

      const result = await service.getPointById('invalid-id');

      expect(result).toBeNull();
    });
  });

  describe('updatePoint', () => {
    it('should update point successfully', async () => {
      const updateData: Prisma.PointUpdateInput = {
        name: 'Updated Point',
        symbol: 'UPD',
      };

      const updatedPoint = {
        ...mockPoint,
        name: 'Updated Point',
        symbol: 'UPD',
      };
      repository.update.mockResolvedValue(updatedPoint);

      const result = await service.updatePoint('point-1', updateData);

      expect(result).toEqual(updatedPoint);
      expect(repository.update).toHaveBeenCalledWith({
        where: { id: 'point-1' },
        data: updateData,
      });
    });

    it('should throw error if point not found', async () => {
      const updateData: Prisma.PointUpdateInput = {
        name: 'Updated Point',
      };

      repository.update.mockRejectedValue(new Error('Point not found'));

      await expect(
        service.updatePoint('invalid-id', updateData),
      ).rejects.toThrow('Point not found');
    });
  });

  describe('deletePoint', () => {
    it('should delete point successfully', async () => {
      repository.delete.mockResolvedValue(mockPoint);

      const result = await service.deletePoint('point-1', 'merchant-1');

      expect(result).toEqual(mockPoint);
      expect(repository.delete).toHaveBeenCalledWith({
        where: { id: 'point-1', merchantId: 'merchant-1' },
      });
    });

    it('should throw error if point not found', async () => {
      repository.delete.mockRejectedValue(new Error('Point not found'));

      await expect(
        service.deletePoint('invalid-id', 'merchant-1'),
      ).rejects.toThrow('Point not found');
    });
  });

  describe('getAllPoints', () => {
    const mockMerchant = {
      id: 'merchant-1',
      name: 'Test Merchant',
      description: 'Test description',
      imageUrl: 'https://test.com/image.png',
    };

    const mockPointWithRelations = {
      ...mockPoint,
      merchant: mockMerchant,
      _count: {
        transactions: 10,
        customerPoints: 5,
        voucherCodes: 2,
      },
    };

    it('should return all points with pagination', async () => {
      repository.findMany.mockResolvedValue([mockPointWithRelations]);
      repository.count.mockResolvedValue(1);

      const result = await service.getAllPoints({});

      expect(result.points).toEqual([mockPointWithRelations]);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
    });

    it('should filter by name', async () => {
      repository.findMany.mockResolvedValue([mockPointWithRelations]);
      repository.count.mockResolvedValue(1);

      await service.getAllPoints({ name: 'Test' });

      expect(repository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            name: {
              contains: 'Test',
              mode: 'insensitive',
            },
          }),
        }),
      );
    });

    it('should filter by symbol', async () => {
      repository.findMany.mockResolvedValue([mockPointWithRelations]);
      repository.count.mockResolvedValue(1);

      await service.getAllPoints({ symbol: 'TST' });

      expect(repository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            symbol: {
              contains: 'TST',
              mode: 'insensitive',
            },
          }),
        }),
      );
    });

    it('should filter by merchantId', async () => {
      repository.findMany.mockResolvedValue([mockPointWithRelations]);
      repository.count.mockResolvedValue(1);

      await service.getAllPoints({ merchantId: 'merchant-1' });

      expect(repository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            merchantId: 'merchant-1',
          }),
        }),
      );
    });

    it('should filter by merchantName', async () => {
      repository.findMany.mockResolvedValue([mockPointWithRelations]);
      repository.count.mockResolvedValue(1);

      await service.getAllPoints({ merchantName: 'Test Merchant' });

      expect(repository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            merchant: {
              name: {
                contains: 'Test Merchant',
                mode: 'insensitive',
              },
            },
          }),
        }),
      );
    });

    it('should filter by pointName', async () => {
      repository.findMany.mockResolvedValue([mockPointWithRelations]);
      repository.count.mockResolvedValue(1);

      await service.getAllPoints({ pointName: 'Test Point' });

      expect(repository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            name: {
              contains: 'Test Point',
              mode: 'insensitive',
            },
          }),
        }),
      );
    });

    it('should handle pagination correctly', async () => {
      repository.findMany.mockResolvedValue([mockPointWithRelations]);
      repository.count.mockResolvedValue(25);

      const result = await service.getAllPoints({ page: 2, limit: 10 });

      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(3);
      expect(repository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        }),
      );
    });

    it('should use default page and limit values', async () => {
      repository.findMany.mockResolvedValue([mockPointWithRelations]);
      repository.count.mockResolvedValue(1);

      await service.getAllPoints({});

      expect(repository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 20,
        }),
      );
    });

    it('should include merchant relations and counts', async () => {
      repository.findMany.mockResolvedValue([mockPointWithRelations]);
      repository.count.mockResolvedValue(1);

      await service.getAllPoints({});

      expect(repository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            merchant: {
              select: {
                id: true,
                name: true,
                description: true,
                imageUrl: true,
              },
            },
            _count: {
              select: {
                transactions: true,
                customerPoints: true,
                voucherCodes: true,
              },
            },
          },
        }),
      );
    });

    it('should order by createdAt desc', async () => {
      repository.findMany.mockResolvedValue([mockPointWithRelations]);
      repository.count.mockResolvedValue(1);

      await service.getAllPoints({});

      expect(repository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: {
            createdAt: 'desc',
          },
        }),
      );
    });

    it('should return empty array when no points match filters', async () => {
      repository.findMany.mockResolvedValue([]);
      repository.count.mockResolvedValue(0);

      const result = await service.getAllPoints({ name: 'NonExistent' });

      expect(result.points).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });
  });
});
