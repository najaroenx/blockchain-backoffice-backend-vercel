jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));
import { ApiKeyDBService } from '../src/modules/internal/api-key/services/api-key-db.service';
import { ApiKeyRepository } from '../src/modules/internal/api-key/api-key.repository';
import { PageOptionsDto } from 'src/common/dtos';

describe('ApiKeyDBService', () => {
  let service: ApiKeyDBService;
  let repository: jest.Mocked<ApiKeyRepository>;

  beforeEach(() => {
    repository = {
      count: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    } as any;

    service = new ApiKeyDBService(repository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getApiKeys', () => {
    it('should return apiKeys and count', async () => {
      repository.count.mockResolvedValue(1);
      repository.findMany.mockResolvedValue([
        { id: '1', merchantId: 'm1' },
      ] as any);

      const pageOptions: PageOptionsDto = { take: 10, skip: 0 } as any;
      const result = await service.getApiKeys('m1', pageOptions);

      expect(result).toEqual({
        apiKeys: [{ id: '1', merchantId: 'm1' }],
        count: 1,
      });
      expect(repository.count).toHaveBeenCalled();
      expect(repository.findMany).toHaveBeenCalled();
    });
  });

  describe('getApiKey', () => {
    it('should return apiKey detail', async () => {
      repository.findFirst.mockResolvedValue({
        id: '1',
        apiKey: 'abc',
        merchantId: 'm1',
      } as any);
      const result = await service.getApiKey('abc', 'm1');
      expect(result).toEqual({ id: '1', apiKey: 'abc', merchantId: 'm1' });
    });
  });

  describe('getApiKeyById', () => {
    it('should return apiKey detail by id', async () => {
      repository.findFirst.mockResolvedValue({
        id: '1',
        merchantId: 'm1',
      } as any);
      const result = await service.getApiKeyById('1', 'm1');
      expect(result).toEqual({ id: '1', merchantId: 'm1' });
    });
  });

  describe('createApiKey', () => {
    it('should create and return new apiKey', async () => {
      repository.create.mockResolvedValue({
        id: '1',
        apiKey: 'newKey',
        merchantId: 'm1',
      } as any);
      const result = await service.createApiKey('m1', 'newKey', {
        name: 'Test Key',
      } as any);
      expect(result).toEqual({ id: '1', apiKey: 'newKey', merchantId: 'm1' });
    });
  });

  describe('deleteApiKey', () => {
    it('should delete and return apiKey', async () => {
      repository.delete.mockResolvedValue({ id: '1', merchantId: 'm1' } as any);
      const result = await service.deleteApiKey('1', 'm1');
      expect(result).toEqual({ id: '1', merchantId: 'm1' });
    });
  });
});
