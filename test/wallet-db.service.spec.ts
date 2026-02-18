jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { WalletDBService } from '../src/modules/internal/wallet/services/wallet-db.service';
import { WalletRepository } from '../src/modules/internal/wallet/wallet.repository';

describe('WalletDBService', () => {
  let service: WalletDBService;

  const repo = {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };

  const mockWallet = {
    id: 'wallet-1',
    walletAddress: '0xWallet123',
    seedPhrase: 'seed',
    chainCode: 'chain',
    derivationIndex: 0,
    type: 'customer',
    status: 'active',
    phoneNumber: '0812345678',
    email: 'test@example.com',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletDBService,
        { provide: WalletRepository, useValue: repo },
      ],
    }).compile();

    service = module.get(WalletDBService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getWalletByPhoneOrEmail', () => {
    it('should find wallet by phone number', async () => {
      repo.findFirst.mockResolvedValue(mockWallet);

      const result = await service.getWalletByPhoneOrEmail('0812345678');

      expect(repo.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [{ phoneNumber: '0812345678' }],
        },
      });
      expect(result).toEqual(mockWallet);
    });

    it('should find wallet by email', async () => {
      repo.findFirst.mockResolvedValue(mockWallet);

      const result = await service.getWalletByPhoneOrEmail(
        undefined,
        'test@example.com',
      );

      expect(repo.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [{ email: 'test@example.com' }],
        },
      });
      expect(result).toEqual(mockWallet);
    });

    it('should find wallet by both phone and email', async () => {
      repo.findFirst.mockResolvedValue(mockWallet);

      const result = await service.getWalletByPhoneOrEmail(
        '0812345678',
        'test@example.com',
      );

      expect(repo.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [{ phoneNumber: '0812345678' }, { email: 'test@example.com' }],
        },
      });
    });

    it('should return null when neither phone nor email provided', async () => {
      const result = await service.getWalletByPhoneOrEmail();

      expect(repo.findFirst).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should return null when wallet not found', async () => {
      repo.findFirst.mockResolvedValue(null);

      const result = await service.getWalletByPhoneOrEmail('0000000000');

      expect(result).toBeNull();
    });
  });

  describe('getWalletById', () => {
    it('should return wallet when found', async () => {
      repo.findUnique.mockResolvedValue(mockWallet);

      const result = await service.getWalletById('wallet-1');

      expect(repo.findUnique).toHaveBeenCalledWith({
        where: { id: 'wallet-1' },
      });
      expect(result).toEqual(mockWallet);
    });

    it('should throw NotFoundException when wallet not found', async () => {
      repo.findUnique.mockResolvedValue(null);

      await expect(service.getWalletById('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getWalletByCustomerId', () => {
    it('should return wallet for customer', async () => {
      repo.findFirst.mockResolvedValue(mockWallet);

      const result = await service.getWalletByCustomerId('customer-1');

      expect(repo.findFirst).toHaveBeenCalledWith({
        where: { customer: { id: 'customer-1' } },
      });
      expect(result).toEqual(mockWallet);
    });

    it('should return null when no wallet found', async () => {
      repo.findFirst.mockResolvedValue(null);

      const result = await service.getWalletByCustomerId('customer-999');

      expect(result).toBeNull();
    });
  });

  describe('getWalletByMerchantId', () => {
    it('should return wallet for merchant', async () => {
      repo.findFirst.mockResolvedValue(mockWallet);

      const result = await service.getWalletByMerchantId('merchant-1');

      expect(repo.findFirst).toHaveBeenCalledWith({
        where: { merchant: { id: 'merchant-1' } },
      });
      expect(result).toEqual(mockWallet);
    });

    it('should return null when no wallet found', async () => {
      repo.findFirst.mockResolvedValue(null);

      const result = await service.getWalletByMerchantId('merchant-999');

      expect(result).toBeNull();
    });
  });

  describe('getWalletByAddress', () => {
    it('should return wallet with customer relations', async () => {
      const walletWithRelations = {
        ...mockWallet,
        customer: { id: 'cust-1', customerPoints: [] },
      };
      repo.findFirst.mockResolvedValue(walletWithRelations);

      const result = await service.getWalletByAddress('0xWallet123');

      expect(repo.findFirst).toHaveBeenCalledWith({
        where: { walletAddress: '0xWallet123' },
        include: {
          customer: {
            include: {
              customerPoints: { include: { point: true } },
            },
          },
        },
      });
      expect(result).toEqual(walletWithRelations);
    });
  });

  describe('getCustomerByWalletAddress', () => {
    it('should return customer when wallet found', async () => {
      const mockCustomer = { id: 'cust-1', email: 'test@test.com' };
      repo.findFirst.mockResolvedValue({ customer: mockCustomer });

      const result = await service.getCustomerByWalletAddress('0xWallet123');

      expect(result).toEqual(mockCustomer);
    });

    it('should return null when wallet not found', async () => {
      repo.findFirst.mockResolvedValue(null);

      const result = await service.getCustomerByWalletAddress('0xNonexistent');

      expect(result).toBeNull();
    });
  });

  describe('createWallet', () => {
    it('should create and return new wallet', async () => {
      const newWallet = { ...mockWallet, id: 'wallet-new' };
      repo.create.mockResolvedValue(newWallet);

      const data = {
        walletAddress: '0xNewWallet',
        seedPhrase: 'seed',
        chainCode: 'chain',
        derivationIndex: 0,
        email: 'new@test.com',
        phoneNumber: '0899999999',
        type: 'customer',
        status: 'active',
      };

      const result = await service.createWallet(data);

      expect(repo.create).toHaveBeenCalledWith({ data });
      expect(result).toEqual(newWallet);
    });
  });

  describe('updateWallet', () => {
    it('should update wallet', async () => {
      const updated = { ...mockWallet, email: 'updated@test.com' };
      repo.update.mockResolvedValue(updated);

      const result = await service.updateWallet('wallet-1', {
        email: 'updated@test.com',
      });

      expect(repo.update).toHaveBeenCalledWith({
        where: { id: 'wallet-1' },
        data: { email: 'updated@test.com' },
      });
      expect(result).toEqual(updated);
    });
  });

  describe('getSellerWalletByMerchantId', () => {
    it('should return seller wallet when found', async () => {
      const merchantWallet = {
        ...mockWallet,
        type: 'merchant',
        derivationIndex: 0,
        phoneNumber: '0812345678',
      };
      const sellerWallet = {
        ...mockWallet,
        id: 'wallet-seller',
        type: 'seller',
        derivationIndex: 1,
      };

      repo.findFirst
        .mockResolvedValueOnce(merchantWallet) // first call: merchant wallet
        .mockResolvedValueOnce(sellerWallet); // second call: seller wallet

      const result = await service.getSellerWalletByMerchantId('merchant-1');

      expect(result).toEqual(sellerWallet);
    });

    it('should return null when merchant wallet not found', async () => {
      repo.findFirst.mockResolvedValue(null);

      const result = await service.getSellerWalletByMerchantId('merchant-999');

      expect(result).toBeNull();
    });

    it('should return null when seller wallet not found', async () => {
      const merchantWallet = {
        ...mockWallet,
        type: 'merchant',
        derivationIndex: 0,
      };

      repo.findFirst
        .mockResolvedValueOnce(merchantWallet)
        .mockResolvedValueOnce(null);

      const result = await service.getSellerWalletByMerchantId('merchant-1');

      expect(result).toBeNull();
    });
  });
});
