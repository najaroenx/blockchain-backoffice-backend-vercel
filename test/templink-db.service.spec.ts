jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));
import { Test, TestingModule } from '@nestjs/testing';
import { TempLinkDBService } from '../src/modules/internal/templink/service/templink-db.service';
import { TempLinkRepository } from '../src/modules/internal/templink/templink.repository';

describe('TempLinkDBService', () => {
  let service: TempLinkDBService;
  let repository: jest.Mocked<any>;

  const mockTempLink = {
    id: 'tl-1',
    uid: 'uid-abc',
    phoneNumber: '0812345678',
    merchantId: 'merchant-1',
    expire: new Date(Date.now() + 86400000),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockRepo = {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TempLinkDBService,
        { provide: TempLinkRepository, useValue: mockRepo },
      ],
    }).compile();

    service = module.get<TempLinkDBService>(TempLinkDBService);
    repository = module.get(TempLinkRepository);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createTempLink', () => {
    it('should create and return a temp link', async () => {
      repository.create.mockResolvedValue(mockTempLink);

      const result = await service.createTempLink({
        uid: 'uid-abc',
        phoneNumber: '0812345678',
        merchantId: 'merchant-1',
        expire: new Date(),
      } as any);

      expect(repository.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ uid: 'uid-abc' }),
      });
      expect(result).toEqual(mockTempLink);
    });
  });

  describe('getTempLinkByUid', () => {
    it('should return temp link when found', async () => {
      repository.findUnique.mockResolvedValue(mockTempLink);

      const result = await service.getTempLinkByUid('uid-abc');

      expect(repository.findUnique).toHaveBeenCalledWith({
        where: { uid: 'uid-abc' },
      });
      expect(result).toEqual(mockTempLink);
    });

    it('should return null when not found', async () => {
      repository.findUnique.mockResolvedValue(null);

      const result = await service.getTempLinkByUid('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getTempLinkByPhoneNumber', () => {
    it('should return temp link by phone number', async () => {
      repository.findFirst.mockResolvedValue(mockTempLink);

      const result = await service.getTempLinkByPhoneNumber('0812345678');

      expect(repository.findFirst).toHaveBeenCalledWith({
        where: { phoneNumber: '0812345678' },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(mockTempLink);
    });

    it('should return null when not found', async () => {
      repository.findFirst.mockResolvedValue(null);

      const result = await service.getTempLinkByPhoneNumber('0000000000');

      expect(result).toBeNull();
    });
  });

  describe('getTempLinksByMerchant', () => {
    it('should return all temp links for a merchant', async () => {
      repository.findMany.mockResolvedValue([mockTempLink]);

      const result = await service.getTempLinksByMerchant('merchant-1');

      expect(repository.findMany).toHaveBeenCalledWith({
        where: { merchantId: 'merchant-1' },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual([mockTempLink]);
    });

    it('should return empty array when none exist', async () => {
      repository.findMany.mockResolvedValue([]);

      const result = await service.getTempLinksByMerchant('merchant-x');

      expect(result).toEqual([]);
    });
  });

  describe('deleteTempLink', () => {
    it('should delete and return the temp link', async () => {
      repository.delete.mockResolvedValue(mockTempLink);

      const result = await service.deleteTempLink('uid-abc');

      expect(repository.delete).toHaveBeenCalledWith({
        where: { uid: 'uid-abc' },
      });
      expect(result).toEqual(mockTempLink);
    });
  });

  describe('deleteExpiredTempLinks', () => {
    it('should delete expired links and return count', async () => {
      repository.deleteMany.mockResolvedValue({ count: 5 });

      const result = await service.deleteExpiredTempLinks();

      expect(repository.deleteMany).toHaveBeenCalledWith({
        where: {
          expire: {
            lt: expect.any(Date),
          },
        },
      });
      expect(result).toBe(5);
    });

    it('should return 0 when none expired', async () => {
      repository.deleteMany.mockResolvedValue({ count: 0 });

      const result = await service.deleteExpiredTempLinks();

      expect(result).toBe(0);
    });
  });

  describe('updateTempLink', () => {
    it('should update temp link by uid', async () => {
      const updated = { ...mockTempLink, phoneNumber: '0899999999' };
      repository.update.mockResolvedValue(updated);

      const result = await service.updateTempLink('uid-abc', {
        phoneNumber: '0899999999',
      });

      expect(repository.update).toHaveBeenCalledWith({
        where: { uid: 'uid-abc' },
        data: { phoneNumber: '0899999999' },
      });
      expect(result.phoneNumber).toBe('0899999999');
    });
  });

  describe('updateTempLinkById', () => {
    it('should update temp link by id', async () => {
      const updated = { ...mockTempLink, phoneNumber: '0877777777' };
      repository.update.mockResolvedValue(updated);

      const result = await service.updateTempLinkById('tl-1', {
        phoneNumber: '0877777777',
      });

      expect(repository.update).toHaveBeenCalledWith({
        where: { id: 'tl-1' },
        data: { phoneNumber: '0877777777' },
      });
      expect(result.phoneNumber).toBe('0877777777');
    });
  });

  describe('getActiveTempLink', () => {
    it('should return active (non-expired) temp link', async () => {
      repository.findFirst.mockResolvedValue(mockTempLink);

      const result = await service.getActiveTempLink('uid-abc');

      expect(repository.findFirst).toHaveBeenCalledWith({
        where: {
          uid: 'uid-abc',
          expire: {
            gt: expect.any(Date),
          },
        },
      });
      expect(result).toEqual(mockTempLink);
    });

    it('should return null when no active link', async () => {
      repository.findFirst.mockResolvedValue(null);

      const result = await service.getActiveTempLink('expired-uid');

      expect(result).toBeNull();
    });
  });
});
