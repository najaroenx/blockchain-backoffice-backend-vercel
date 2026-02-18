jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));
import { InternalServerErrorException } from '@nestjs/common';
import { GetApiKeys } from 'src/modules/internal/api-key/handlers/getApiKeys.handler';
import { ApiKeyDBService } from 'src/modules/internal/api-key/services/api-key-db.service';

describe('GetApiKeys', () => {
  let handler: GetApiKeys;
  let db: jest.Mocked<ApiKeyDBService>;

  beforeEach(() => {
    db = { getApiKeys: jest.fn() } as any;
    handler = new GetApiKeys(db);
    jest.clearAllMocks();
  });

  it('should return api keys with pagination bounds', async () => {
    const mockResult = {
      apiKeys: [
        { id: 'ak-1', name: 'Key 1' },
        { id: 'ak-2', name: 'Key 2' },
      ],
      count: 2,
    };
    db.getApiKeys.mockResolvedValue(mockResult as any);

    const pageOptions = { skip: 0, take: 10 } as any;
    const result = await handler.execute('merchant-1', pageOptions);

    expect(result.apiKeys).toHaveLength(2);
    expect(result.counts).toBe(2);
    expect(result.lower).toBe(0);
    expect(result.upper).toBe(9);
  });

  it('should return empty array when no keys exist', async () => {
    db.getApiKeys.mockResolvedValue({ apiKeys: [], count: 0 } as any);

    const result = await handler.execute('merchant-1', {
      skip: 0,
      take: 10,
    } as any);

    expect(result.apiKeys).toEqual([]);
    expect(result.counts).toBe(0);
  });

  it('should throw InternalServerErrorException on error', async () => {
    db.getApiKeys.mockRejectedValue(new Error('DB failed'));

    await expect(
      handler.execute('merchant-1', { skip: 0, take: 10 } as any),
    ).rejects.toThrow(InternalServerErrorException);
  });
});
