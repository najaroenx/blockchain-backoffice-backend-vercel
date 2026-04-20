import { Test, TestingModule } from '@nestjs/testing';
import { MerchantDBService } from '../src/modules/internal/merchant/services/merchant-db.service';
import { MerchantRepository } from '../src/modules/internal/merchant/merchant.repository';
import { Merchant, Prisma } from '@prisma/client';

describe('MerchantDBService', () => {
  let service: MerchantDBService;
  let repository: jest.Mocked<MerchantRepository>;

  const mockWallet = {
    id: 'wallet-1',
    address: Buffer.from('0x1234567890123456789012345678901234567890', 'hex'),
    privateKey: 'encrypted-key',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockMerchant: Merchant = {
    id: 'merchant-1',
    name: 'Test Merchant',
    walletId: 'wallet-1',
    location: 'Bangkok',
    website: 'https://test.com',
    tel: '0887654321',
    description: 'Test description',
    imageUrl: 'https://test.com/image.png',
    points: 0,
    voucherIds: [],
    status: true,
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
        MerchantDBService,
        {
          provide: MerchantRepository,
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<MerchantDBService>(MerchantDBService);
    repository = module.get(MerchantRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createMerchant', () => {
    it('should create a new merchant successfully', async () => {
      const createData: Omit<Prisma.MerchantCreateInput, 'userMerchant'> = {
        name: 'New Merchant',
        location: 'Chiang Mai',
        website: 'https://newmerchant.com',
        tel: '0811111111',
      };

      repository.create.mockResolvedValue(mockMerchant);

      const result = await service.createMerchant('user-1', createData);

      expect(result).toEqual(mockMerchant);
      expect(repository.create).toHaveBeenCalledWith({
        data: {
          ...createData,
          userMerchant: {
            create: {
              userId: 'user-1',
            },
          },
        },
      });
    });

    it('should throw error if repository.create fails', async () => {
      const createData: Omit<Prisma.MerchantCreateInput, 'userMerchant'> = {
        name: 'New Merchant',
        location: 'Chiang Mai',
        website: 'https://newmerchant.com',
        tel: '0811111111',
      };

      repository.create.mockRejectedValue(new Error('Database error'));

      await expect(
        service.createMerchant('user-1', createData),
      ).rejects.toThrow('Database error');
    });
  });

  describe('getMerchants', () => {
    it('should return merchants for a specific user', async () => {
      const merchantsWithWallet = [{ ...mockMerchant, wallet: mockWallet }];
      repository.findMany.mockResolvedValue(merchantsWithWallet);

      const result = await service.getMerchants('user-1');

      expect(result).toEqual(merchantsWithWallet);
      expect(repository.findMany).toHaveBeenCalledWith({
        where: {
          userMerchant: {
            some: {
              userId: 'user-1',
            },
          },
        },
        include: {
          wallet: true,
        },
      });
    });

    it('should return empty array when no merchants found', async () => {
      repository.findMany.mockResolvedValue([]);

      const result = await service.getMerchants('user-1');

      expect(result).toEqual([]);
    });

    it('should include wallet information', async () => {
      const merchantsWithWallet = [{ ...mockMerchant, wallet: mockWallet }];
      repository.findMany.mockResolvedValue(merchantsWithWallet);

      const result = await service.getMerchants('user-1');

      expect(result[0]).toHaveProperty('wallet');
      expect(result[0].wallet).toEqual(mockWallet);
    });
  });

  describe('getMerchantById', () => {
    it('should return merchant by ID with wallet', async () => {
      const merchantWithWallet = { ...mockMerchant, wallet: mockWallet };
      repository.findUnique.mockResolvedValue(merchantWithWallet);

      const result = await service.getMerchantById('merchant-1');

      expect(result).toEqual(merchantWithWallet);
      expect(repository.findUnique).toHaveBeenCalledWith({
        where: {
          id: 'merchant-1',
        },
        include: {
          wallet: true,
        },
      });
    });

    it('should return null when merchant not found', async () => {
      repository.findUnique.mockResolvedValue(null);

      const result = await service.getMerchantById('invalid-id');

      expect(result).toBeNull();
    });
  });

  describe('updateMerchant', () => {
    it('should update merchant successfully', async () => {
      const updateData: Prisma.MerchantUpdateInput = {
        name: 'Updated Merchant',
        location: 'Phuket',
      };

      const updatedMerchant = {
        ...mockMerchant,
        name: 'Updated Merchant',
        location: 'Phuket',
      };
      repository.update.mockResolvedValue(updatedMerchant);

      const result = await service.updateMerchant('merchant-1', updateData);

      expect(result).toEqual(updatedMerchant);
      expect(repository.update).toHaveBeenCalledWith({
        where: {
          id: 'merchant-1',
        },
        data: updateData,
      });
    });

    it('should throw error if merchant not found', async () => {
      const updateData: Prisma.MerchantUpdateInput = {
        name: 'Updated Merchant',
      };

      repository.update.mockRejectedValue(new Error('Merchant not found'));

      await expect(
        service.updateMerchant('invalid-id', updateData),
      ).rejects.toThrow('Merchant not found');
    });
  });

  describe('deleteMerchant', () => {
    it('should delete merchant successfully', async () => {
      repository.delete.mockResolvedValue(mockMerchant);

      const result = await service.deleteMerchant('merchant-1');

      expect(result).toEqual(mockMerchant);
      expect(repository.delete).toHaveBeenCalledWith({
        where: {
          id: 'merchant-1',
        },
      });
    });

    it('should throw error if merchant not found', async () => {
      repository.delete.mockRejectedValue(new Error('Merchant not found'));

      await expect(service.deleteMerchant('invalid-id')).rejects.toThrow(
        'Merchant not found',
      );
    });
  });

  describe('getAllMerchants', () => {
    it('should return all merchants with pagination', async () => {
      const merchantsWithRelations = [
        {
          ...mockMerchant,
          wallet: mockWallet,
          point: [],
        },
      ];

      repository.findMany.mockResolvedValue(merchantsWithRelations);
      repository.count.mockResolvedValue(1);

      const result = await service.getAllMerchants({});

      expect(result.merchants).toEqual(merchantsWithRelations);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
    });

    it('should filter by name', async () => {
      repository.findMany.mockResolvedValue([mockMerchant]);
      repository.count.mockResolvedValue(1);

      await service.getAllMerchants({ name: 'Test' });

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

    it('should filter by location', async () => {
      repository.findMany.mockResolvedValue([mockMerchant]);
      repository.count.mockResolvedValue(1);

      await service.getAllMerchants({ location: 'Bangkok' });

      expect(repository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            location: {
              contains: 'Bangkok',
              mode: 'insensitive',
            },
          }),
        }),
      );
    });

    it('should filter by website', async () => {
      repository.findMany.mockResolvedValue([mockMerchant]);
      repository.count.mockResolvedValue(1);

      await service.getAllMerchants({ website: 'test.com' });

      expect(repository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            website: {
              contains: 'test.com',
              mode: 'insensitive',
            },
          }),
        }),
      );
    });

    it('should filter by hasWallet true', async () => {
      repository.findMany.mockResolvedValue([mockMerchant]);
      repository.count.mockResolvedValue(1);

      await service.getAllMerchants({ hasWallet: true });

      expect(repository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            walletId: { not: null },
          }),
        }),
      );
    });

    it('should filter by hasWallet false', async () => {
      repository.findMany.mockResolvedValue([]);
      repository.count.mockResolvedValue(0);

      await service.getAllMerchants({ hasWallet: false });

      expect(repository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            walletId: null,
          }),
        }),
      );
    });

    it('should filter by pointId', async () => {
      repository.findMany.mockResolvedValue([mockMerchant]);
      repository.count.mockResolvedValue(1);

      await service.getAllMerchants({ pointId: 'point-1' });

      expect(repository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            point: {
              some: {
                id: 'point-1',
              },
            },
          }),
        }),
      );
    });

    it('should handle pagination correctly', async () => {
      repository.findMany.mockResolvedValue([mockMerchant]);
      repository.count.mockResolvedValue(25);

      const result = await service.getAllMerchants({ page: 2, limit: 10 });

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
      repository.findMany.mockResolvedValue([mockMerchant]);
      repository.count.mockResolvedValue(1);

      await service.getAllMerchants({});

      expect(repository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 20,
        }),
      );
    });

    it('should return empty array when no merchants match filters', async () => {
      repository.findMany.mockResolvedValue([]);
      repository.count.mockResolvedValue(0);

      const result = await service.getAllMerchants({ name: 'NonExistent' });

      expect(result.merchants).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });
  });
});
