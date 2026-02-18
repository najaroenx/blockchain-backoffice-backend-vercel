jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));
import {
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { DeleteMerchant } from 'src/modules/internal/merchant/handlers/deleteMerchant.handler';
import { MerchantDBService } from 'src/modules/internal/merchant/services/merchant-db.service';
import { PrismaService } from 'prisma/prisma.service';

describe('DeleteMerchant', () => {
  let handler: DeleteMerchant;
  let dbService: jest.Mocked<MerchantDBService>;
  let prisma: any;

  const mockMerchant = {
    id: 'merchant-123',
    name: 'Test Merchant',
    walletId: 'wallet-123',
  };

  beforeEach(() => {
    dbService = {
      getMerchantById: jest.fn(),
    } as any;

    const deletedMerchant = { ...mockMerchant };
    prisma = {
      $transaction: jest.fn((fn: any) =>
        fn({
          merchant: { delete: jest.fn().mockResolvedValue(deletedMerchant) },
          wallet: { delete: jest.fn().mockResolvedValue({}) },
        }),
      ),
    };

    handler = new DeleteMerchant(dbService, prisma as any);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should delete merchant and wallet successfully', async () => {
    dbService.getMerchantById.mockResolvedValue(mockMerchant as any);

    const result = await handler.execute('merchant-123');

    expect(dbService.getMerchantById).toHaveBeenCalledWith('merchant-123');
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.message).toBe('Merchant and wallet deleted successfully');
  });

  it('should delete merchant without wallet when walletId is null', async () => {
    const merchantNoWallet = { ...mockMerchant, walletId: null };
    dbService.getMerchantById.mockResolvedValue(merchantNoWallet as any);

    const result = await handler.execute('merchant-123');

    expect(result.success).toBe(true);
  });

  it('should throw NotFoundException when merchant not found', async () => {
    dbService.getMerchantById.mockResolvedValue(null as any);

    await expect(handler.execute('nonexistent')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should throw InternalServerErrorException on DB error', async () => {
    dbService.getMerchantById.mockResolvedValue(mockMerchant as any);
    prisma.$transaction.mockRejectedValue(new Error('Transaction failed'));

    await expect(handler.execute('merchant-123')).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
