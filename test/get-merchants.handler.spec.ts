jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));
import { InternalServerErrorException } from '@nestjs/common';
import { GetMerchants } from 'src/modules/internal/merchant/handlers/getMerchants.handler';
import { MerchantDBService } from 'src/modules/internal/merchant/services/merchant-db.service';

describe('GetMerchants', () => {
  let handler: GetMerchants;
  let dbService: jest.Mocked<MerchantDBService>;

  beforeEach(() => {
    dbService = {
      getMerchants: jest.fn(),
      getAllMerchants: jest.fn(),
    } as any;

    handler = new GetMerchants(dbService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  describe('execute', () => {
    it('should return formatted merchants list', async () => {
      const mockMerchants = [
        {
          id: 'merchant-1',
          name: 'Merchant One',
          tel: '0812345678',
          wallet: { walletAddress: '0xWallet1' },
          description: 'Desc 1',
        },
        {
          id: 'merchant-2',
          name: 'Merchant Two',
          tel: '0898765432',
          wallet: null,
          description: 'Desc 2',
        },
      ];
      dbService.getMerchants.mockResolvedValue(mockMerchants as any);

      const result = await handler.execute('user-1');

      expect(dbService.getMerchants).toHaveBeenCalledWith('user-1');
      expect(result.merchants).toHaveLength(2);
      expect(result.merchants[0].walletAddress).toBe('0xWallet1');
      expect(result.merchants[0].phoneNumber).toBe('0812345678');
      expect(result.merchants[0]).not.toHaveProperty('wallet');
      expect(result.merchants[0]).not.toHaveProperty('tel');
      expect(result.merchants[1].walletAddress).toBe('');
      expect(result.counts).toBe(2);
    });

    it('should return empty list when no merchants', async () => {
      dbService.getMerchants.mockResolvedValue([]);

      const result = await handler.execute('user-1');

      expect(result.merchants).toHaveLength(0);
      expect(result.counts).toBe(0);
    });

    it('should throw InternalServerErrorException on error', async () => {
      dbService.getMerchants.mockRejectedValue(new Error('DB failed'));

      await expect(handler.execute('user-1')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('getListMerchants', () => {
    it('should return all merchants', async () => {
      const mockDbResult = {
        merchants: [
          { id: 'm-1', wallet: { walletAddress: '0x1' }, tel: '081' },
          { id: 'm-2', wallet: null, tel: '082' },
        ],
      };
      dbService.getAllMerchants.mockResolvedValue(mockDbResult as any);

      const result = await handler.getListMerchants();

      expect(dbService.getAllMerchants).toHaveBeenCalledWith({});
      expect(result.merchants).toHaveLength(2);
      expect(result.merchants[0].walletAddress).toBe('0x1');
      expect(result.merchants[0].phoneNumber).toBe('081');
      expect(result.merchants[1].walletAddress).toBe('');
      expect(result.counts).toBe(2);
    });

    it('should throw InternalServerErrorException on error', async () => {
      dbService.getAllMerchants.mockRejectedValue(new Error('DB failed'));

      await expect(handler.getListMerchants()).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
