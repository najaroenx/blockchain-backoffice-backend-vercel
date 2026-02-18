jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));
import {
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { UpdateMerchant } from 'src/modules/internal/merchant/handlers/updateMerchant.handler';
import { MerchantDBService } from 'src/modules/internal/merchant/services/merchant-db.service';
import { Prisma } from '@prisma/client';

describe('UpdateMerchant', () => {
  let handler: UpdateMerchant;
  let dbService: jest.Mocked<MerchantDBService>;

  const mockMerchant = {
    id: 'merchant-123',
    name: 'Updated Merchant',
    description: 'Updated desc',
  };

  beforeEach(() => {
    dbService = {
      updateMerchant: jest.fn(),
    } as any;

    handler = new UpdateMerchant(dbService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should update merchant successfully', async () => {
    dbService.updateMerchant.mockResolvedValue(mockMerchant as any);

    const updateData: Prisma.MerchantUpdateInput = { name: 'Updated Merchant' };
    const result = await handler.execute('merchant-123', updateData);

    expect(dbService.updateMerchant).toHaveBeenCalledWith(
      'merchant-123',
      updateData,
    );
    expect(result).toEqual({ merchant: mockMerchant });
  });

  it('should throw NotFoundException when merchant not found (Prisma P2025)', async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError(
      'Record not found',
      { code: 'P2025', clientVersion: '5.0.0' },
    );
    dbService.updateMerchant.mockRejectedValue(prismaError);

    await expect(
      handler.execute('nonexistent', { name: 'Test' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw InternalServerErrorException on other errors', async () => {
    dbService.updateMerchant.mockRejectedValue(new Error('DB failed'));

    await expect(
      handler.execute('merchant-123', { name: 'Test' }),
    ).rejects.toThrow(InternalServerErrorException);
  });
});
