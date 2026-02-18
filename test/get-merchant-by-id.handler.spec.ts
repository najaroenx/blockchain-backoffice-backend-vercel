jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));
import {
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { GetMerchant } from 'src/modules/internal/merchant/handlers/getMerchantById.handler';
import { MerchantDBService } from 'src/modules/internal/merchant/services/merchant-db.service';

describe('GetMerchant (GetMerchantById)', () => {
  let handler: GetMerchant;
  let dbService: jest.Mocked<MerchantDBService>;

  const mockMerchant = {
    id: 'merchant-123',
    name: 'Test Merchant',
    description: 'Test description',
    website: 'https://test.com',
    tel: '0812345678',
    walletId: 'wallet-123',
  };

  beforeEach(() => {
    dbService = {
      getMerchantById: jest.fn(),
    } as any;

    handler = new GetMerchant(dbService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should return merchant when found', async () => {
    dbService.getMerchantById.mockResolvedValue(mockMerchant as any);

    const result = await handler.execute('merchant-123');

    expect(dbService.getMerchantById).toHaveBeenCalledWith('merchant-123');
    expect(result).toEqual({ merchant: mockMerchant });
  });

  it('should throw InternalServerErrorException when merchant not found (wraps NotFoundException)', async () => {
    dbService.getMerchantById.mockResolvedValue(null as any);

    await expect(handler.execute('nonexistent')).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  it('should throw InternalServerErrorException on unexpected error', async () => {
    dbService.getMerchantById.mockRejectedValue(new Error('DB failed'));

    await expect(handler.execute('merchant-123')).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
