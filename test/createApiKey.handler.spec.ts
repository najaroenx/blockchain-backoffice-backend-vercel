jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));
import { CreateApiKey } from '../src/modules/api-key/handlers/createApiKey.handler';
import { ApiKeyDBService } from '../src/modules/api-key/services/api-key-db.service';
import { TokenService } from 'src/providers/token/token.service';
import { InternalServerErrorException, Logger } from '@nestjs/common';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';

describe('CreateApiKey Handler', () => {
  let handler: CreateApiKey;
  let mockDb: jest.Mocked<ApiKeyDBService>;
  let mockTokenService: jest.Mocked<TokenService>;

  beforeEach(() => {
    mockDb = { createApiKey: jest.fn() } as any;

    mockTokenService = { generateRandomString: jest.fn() } as any;

    handler = new CreateApiKey(mockDb, mockTokenService);

    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should create API key successfully', async () => {
    const mockApiKey = { id: '1', apiKey: 'abc123', merchantId: 'm1' } as any;

    mockTokenService.generateRandomString.mockResolvedValue('abc123');
    mockDb.createApiKey.mockResolvedValue(mockApiKey);

    const result = await handler.execute('m1', { name: 'test-key' });

    expect(mockTokenService.generateRandomString).toHaveBeenCalledWith({});
    expect(mockDb.createApiKey).toHaveBeenCalledWith('m1', 'abc123', {
      name: 'test-key',
    });
    expect(result).toEqual(mockApiKey);
  });

  it('should handle error and throw InternalServerErrorException', async () => {
    mockTokenService.generateRandomString.mockRejectedValue(
      new Error('Token generation failed'),
    );

    await expect(handler.execute('m1', { name: 'test-key' })).rejects.toThrow(
      new InternalServerErrorException(INTERNAL_SERVER_ERROR),
    );

    expect(Logger.prototype.error).toHaveBeenCalled();
  });
});
