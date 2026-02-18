jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));
import {
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { GetApiKey } from 'src/modules/internal/api-key/handlers/getApiKey.handler';
import { ApiKeyDBService } from 'src/modules/internal/api-key/services/api-key-db.service';

describe('GetApiKey', () => {
  let handler: GetApiKey;
  let db: jest.Mocked<ApiKeyDBService>;

  const mockApiKey = {
    id: 'ak-1',
    apiKey: 'test-api-key-12345',
    merchantId: 'merchant-1',
    name: 'Test Key',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    db = { getApiKey: jest.fn() } as any;
    handler = new GetApiKey(db);
    jest.clearAllMocks();
  });

  it('should return api key when found', async () => {
    db.getApiKey.mockResolvedValue(mockApiKey as any);

    const result = await handler.execute('test-api-key-12345', 'merchant-1');

    expect(db.getApiKey).toHaveBeenCalledWith(
      'test-api-key-12345',
      'merchant-1',
    );
    expect(result).toEqual(mockApiKey);
  });

  it('should throw NotFoundException when not found', async () => {
    db.getApiKey.mockResolvedValue(null);

    await expect(handler.execute('nonexistent', 'merchant-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should throw InternalServerErrorException on unexpected error', async () => {
    db.getApiKey.mockRejectedValue(new Error('DB failed'));

    await expect(handler.execute('test-api-key', 'merchant-1')).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
