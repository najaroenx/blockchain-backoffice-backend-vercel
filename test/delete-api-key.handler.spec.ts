jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));
import {
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { DeleteApiKey } from 'src/modules/internal/api-key/handlers/deleteApiKey.handler';
import { ApiKeyDBService } from 'src/modules/internal/api-key/services/api-key-db.service';

describe('DeleteApiKey', () => {
  let handler: DeleteApiKey;
  let db: jest.Mocked<ApiKeyDBService>;

  const mockApiKey = {
    id: 'ak-1',
    apiKey: 'test-key',
    merchantId: 'merchant-1',
  };

  beforeEach(() => {
    db = {
      getApiKeyById: jest.fn(),
      deleteApiKey: jest.fn(),
    } as any;
    handler = new DeleteApiKey(db);
    jest.clearAllMocks();
  });

  it('should delete api key when found', async () => {
    db.getApiKeyById.mockResolvedValue(mockApiKey as any);
    db.deleteApiKey.mockResolvedValue(mockApiKey as any);

    const result = await handler.execute('ak-1', 'merchant-1');

    expect(db.getApiKeyById).toHaveBeenCalledWith('ak-1', 'merchant-1');
    expect(db.deleteApiKey).toHaveBeenCalledWith('ak-1', 'merchant-1');
    expect(result).toEqual(mockApiKey);
  });

  it('should throw NotFoundException when key not found', async () => {
    db.getApiKeyById.mockResolvedValue(null);

    await expect(handler.execute('nonexistent', 'merchant-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should throw InternalServerErrorException on unexpected error', async () => {
    db.getApiKeyById.mockRejectedValue(new Error('DB failed'));

    await expect(handler.execute('ak-1', 'merchant-1')).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
