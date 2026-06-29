jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));
import { BlockchainService } from '../src/providers/blockchain/blockchain.service';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';

// mock ทั้ง ethers, Contract, Wallet
jest.mock('ethers', () => ({
  Contract: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockReturnThis(),
    balanceOf: jest.fn().mockResolvedValue(BigInt(1000000)),
    getListing: jest.fn().mockResolvedValue({
      seller: '0xSeller',
      typeId: BigInt(1),
      amount: BigInt(2),
      pricePerUnit: BigInt(3),
      paymentToken: '0xToken',
      active: true,
      listedAt: BigInt(4),
    }),
    transfer: jest.fn().mockResolvedValue({ hash: '0x123', wait: jest.fn() }),
    mint: jest.fn().mockResolvedValue({ hash: '0x123', wait: jest.fn() }),
    burn: jest.fn().mockResolvedValue({ hash: '0x123', wait: jest.fn() }),
  })),
  Wallet: jest.fn().mockImplementation(() => ({
    address: '0xWallet',
    connect: jest.fn().mockReturnThis(),
  })),
  JsonRpcProvider: jest.fn(),
  ethers: {
    parseEther: jest.fn().mockImplementation((v) => v),
    formatEther: jest.fn().mockImplementation((v) => v.toString()),
  },
}));

describe('BlockchainService (Simple)', () => {
  let service: BlockchainService;
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    mockConfigService = {
      get: jest.fn((key: string) => {
        const map = {
          POINT_FACTORY_ADDRESS: '0xFactory',
          PRIVATE_KEY: '0xPrivate',
          RPC_URL: 'http://localhost:8545',
          MARKETPLACE_ADDRESS: '0xMarketplace',
        };
        return map[key];
      }),
    } as any;

    service = new BlockchainService(mockConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('transaction should return txId', async () => {
    const result = await service.transaction({
      amount: 1,
      to: '0xReceiver',
      pointAddress: '0xPoint',
    });

    expect(result).toEqual({ txId: '0x123' });
  });

  it('mint should return txId', async () => {
    const result = await service.mint({
      amount: 1,
      to: '0xReceiver',
      pointAddress: '0xPoint',
    });

    expect(result.txId).toBe('0x123');
  });

  it('burn should return txId', async () => {
    const result = await service.burn({
      amount: 1,
      senderPrivateKey: '0xSenderKey',
      pointAddress: '0xPoint',
    });

    expect(result.txId).toBe('0x123');
  });

  it('transactionC2C should return txId', async () => {
    const result = await service.transactionC2C({
      amount: 1,
      to: '0xReceiver',
      senderPrivateKey: '0xSender',
      pointAddress: '0xPoint',
    });

    expect(result.txId).toBe('0x123');
  });

  it('should throw InternalServerErrorException if something fails', async () => {
    // Create a new service instance with failing contract
    const ethers = jest.requireMock('ethers');
    ethers.Contract.mockImplementationOnce(() => ({
      connect: jest.fn().mockReturnThis(),
      transfer: jest.fn().mockRejectedValue(new Error('Transaction failed')),
    }));

    const newService = new BlockchainService(mockConfigService);

    await expect(
      newService.transaction({
        amount: 1,
        to: '0xReceiver',
        pointAddress: '0xPoint',
      }),
    ).rejects.toThrow(InternalServerErrorException);
  });

  it('getMarketplaceListing should map getListing response to the existing shape', async () => {
    const ethersModule = jest.requireMock('ethers');
    ethersModule.Contract.mockImplementationOnce(() => ({
      getListing: jest.fn().mockResolvedValue({
        seller: '0xSeller',
        typeId: BigInt(55),
        amount: BigInt(7),
        pricePerUnit: BigInt(2500000000000000000),
        paymentToken: '0xToken',
        active: true,
        listedAt: BigInt(1730000000),
      }),
    }));

    const result = await service.getMarketplaceListing('123');

    expect(result).toEqual({
      seller: '0xSeller',
      typeId: '55',
      amount: '7',
      pricePerUnit: '2500000000000000000',
      paymentToken: '0xToken',
      isActive: true,
      listedAt: 1730000000,
    });
  });

  it('getMarketplaceListing should reject non-numeric listing IDs', async () => {
    await expect(service.getMarketplaceListing('listing-abc')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('getBalance should return formatted balance', async () => {
    const ethersModule = jest.requireMock('ethers');
    ethersModule.Contract.mockImplementationOnce(() => ({
      balanceOf: jest.fn().mockResolvedValue(BigInt(5000000000000000000)),
    }));

    const result = await service.getBalance({
      walletAddress: '0xUser',
      pointAddress: '0xPoint',
    });

    expect(result).toHaveProperty('balance');
    expect(result).toHaveProperty('balanceWei');
  });

  it('getVoucherBalance should return numeric balance', async () => {
    const ethersModule = jest.requireMock('ethers');
    ethersModule.Contract.mockImplementationOnce(() => ({
      balanceOf: jest.fn().mockResolvedValue(BigInt(3)),
    }));

    const configFull = {
      get: jest.fn((key: string) => {
        const map: Record<string, string> = {
          POINT_FACTORY_ADDRESS: '0xFactory',
          PRIVATE_KEY: '0xPrivate',
          RPC_URL: 'http://localhost:8545',
          MARKETPLACE_ADDRESS: '0xMarketplace',
          COUPON_ADDRESS: '0xCoupon',
          THB_ADDRESS: '0xTHB',
          VAULT_ADDRESS: '0xVault',
        };
        return map[key];
      }),
    } as any;
    const svc = new BlockchainService(configFull);
    const result = await svc.getVoucherBalance('42', '0xUser');

    expect(result).toBe(3);
  });

  it('verifyVoucherOwnership should return true when balance > 0', async () => {
    const ethersModule = jest.requireMock('ethers');
    ethersModule.Contract.mockImplementationOnce(() => ({
      balanceOf: jest.fn().mockResolvedValue(BigInt(1)),
    }));

    const configFull = {
      get: jest.fn((key: string) => {
        const map: Record<string, string> = {
          POINT_FACTORY_ADDRESS: '0xFactory',
          PRIVATE_KEY: '0xPrivate',
          RPC_URL: 'http://localhost:8545',
          MARKETPLACE_ADDRESS: '0xMarketplace',
          COUPON_ADDRESS: '0xCoupon',
          THB_ADDRESS: '0xTHB',
          VAULT_ADDRESS: '0xVault',
        };
        return map[key];
      }),
    } as any;
    const svc = new BlockchainService(configFull);
    const result = await svc.verifyVoucherOwnership('42', '0xUser');

    expect(result).toBe(true);
  });

  it('verifyVoucherOwnership should return false when balance is 0', async () => {
    const ethersModule = jest.requireMock('ethers');
    ethersModule.Contract.mockImplementationOnce(() => ({
      balanceOf: jest.fn().mockResolvedValue(BigInt(0)),
    }));

    const configFull = {
      get: jest.fn((key: string) => {
        const map: Record<string, string> = {
          POINT_FACTORY_ADDRESS: '0xFactory',
          PRIVATE_KEY: '0xPrivate',
          RPC_URL: 'http://localhost:8545',
          MARKETPLACE_ADDRESS: '0xMarketplace',
          COUPON_ADDRESS: '0xCoupon',
          THB_ADDRESS: '0xTHB',
          VAULT_ADDRESS: '0xVault',
        };
        return map[key];
      }),
    } as any;
    const svc = new BlockchainService(configFull);
    const result = await svc.verifyVoucherOwnership('42', '0xUser');

    expect(result).toBe(false);
  });

  it('verifyVoucherOwnership should return false on error', async () => {
    // service has no COUPON_ADDRESS — getVoucherBalance throws before creating any Contract
    // verifyVoucherOwnership must catch that and return false
    const result = await service.verifyVoucherOwnership('42', '0xUser');

    expect(result).toBe(false);
  });

  it('getUserTHBBalance should return balance info', async () => {
    const ethersModule = jest.requireMock('ethers');
    ethersModule.Contract.mockImplementationOnce(() => ({
      balanceOf: jest.fn().mockResolvedValue(BigInt(100)),
    }));

    const configWithTHB = {
      get: jest.fn((key: string) => {
        const map: Record<string, string> = {
          POINT_FACTORY_ADDRESS: '0xFactory',
          PRIVATE_KEY: '0xPrivate',
          RPC_URL: 'http://localhost:8545',
          MARKETPLACE_ADDRESS: '0xMarketplace',
          THB_ADDRESS: '0xTHB',
          COUPON_ADDRESS: '0xCoupon',
          VAULT_ADDRESS: '0xVault',
        };
        return map[key];
      }),
    } as any;
    const svc = new BlockchainService(configWithTHB);

    const result = await svc.getUserTHBBalance('0xUser');

    expect(result).toHaveProperty('address', '0xUser');
    expect(result).toHaveProperty('balance');
    expect(result).toHaveProperty('balanceWei');
  });

  it('getUserCouponBalance should return coupon balance', async () => {
    const ethersModule = jest.requireMock('ethers');
    ethersModule.Contract.mockImplementationOnce(() => ({
      balanceOf: jest.fn().mockResolvedValue(BigInt(5)),
    }));

    const configWithCoupon = {
      get: jest.fn((key: string) => {
        const map: Record<string, string> = {
          POINT_FACTORY_ADDRESS: '0xFactory',
          PRIVATE_KEY: '0xPrivate',
          RPC_URL: 'http://localhost:8545',
          MARKETPLACE_ADDRESS: '0xMarketplace',
          COUPON_ADDRESS: '0xCoupon',
          THB_ADDRESS: '0xTHB',
          VAULT_ADDRESS: '0xVault',
        };
        return map[key];
      }),
    } as any;
    const svc = new BlockchainService(configWithCoupon);

    const result = await svc.getUserCouponBalance('0xUser', 1);

    expect(result).toMatchObject({ address: '0xUser', typeId: '1' });
  });

  it('getUserCouponBalanceBatch should return map of typeId to balance', async () => {
    const ethersModule = jest.requireMock('ethers');
    const mockContract = {
      balanceOf: jest.fn(),
      balanceOfBatch: jest.fn().mockResolvedValue([BigInt(3), BigInt(7)]),
    };
    ethersModule.Contract.mockImplementationOnce(() => mockContract);

    const configWithCoupon = {
      get: jest.fn((key: string) => {
        const map: Record<string, string> = {
          POINT_FACTORY_ADDRESS: '0xFactory',
          PRIVATE_KEY: '0xPrivate',
          RPC_URL: 'http://localhost:8545',
          MARKETPLACE_ADDRESS: '0xMarketplace',
          COUPON_ADDRESS: '0xCoupon',
          THB_ADDRESS: '0xTHB',
          VAULT_ADDRESS: '0xVault',
        };
        return map[key];
      }),
    } as any;
    const svc = new BlockchainService(configWithCoupon);

    const result = await svc.getUserCouponBalanceBatch('0xUser', [1, 2]);

    expect(result.get('1')).toBe(3);
    expect(result.get('2')).toBe(7);
  });

  it('invalidateListingsCache should clear the cache', () => {
    (service as any).listingsCache = {
      data: [{ listingId: '1' }],
      timestamp: Date.now(),
    };
    service.invalidateListingsCache();

    expect((service as any).listingsCache).toBeNull();
  });

  it('invalidateListingsCache should not throw when cache is already null', () => {
    (service as any).listingsCache = null;
    expect(() => service.invalidateListingsCache()).not.toThrow();
  });

  it('getAllActiveMarketplaceListings should return cached data within TTL', async () => {
    const cachedData = [{ listingId: '1', seller: '0xSeller' }];
    (service as any).listingsCache = {
      data: cachedData,
      timestamp: Date.now(),
    };

    const result = await service.getAllActiveMarketplaceListings();

    expect(result).toBe(cachedData);
  });

  it('buyVoucherFromMarketplace should throw InternalServerErrorException (deprecated)', async () => {
    await expect(
      service.buyVoucherFromMarketplace('tokenId', '0xBuyer', 100),
    ).rejects.toThrow(InternalServerErrorException);
  });

  it('normalizeListingId should throw BadRequestException for negative number', async () => {
    await expect(service.getMarketplaceListing(-1 as any)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('normalizeListingId should throw BadRequestException for empty string', async () => {
    await expect(service.getMarketplaceListing('')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('transferCoupon should call safeTransferFrom and return tx hash', async () => {
    const mockTxHash = '0xTransferHash';
    const ethersModule = jest.requireMock('ethers');
    ethersModule.Contract.mockImplementation(() => ({
      safeTransferFrom: jest.fn().mockResolvedValue({
        hash: mockTxHash,
        wait: jest.fn().mockResolvedValue({}),
      }),
      connect: jest.fn().mockReturnThis(),
    }));

    const configFull = {
      get: jest.fn((key: string) => {
        const map: Record<string, string> = {
          POINT_FACTORY_ADDRESS: '0xFactory',
          PRIVATE_KEY: '0xPrivate',
          RPC_URL: 'http://localhost:8545',
          MARKETPLACE_ADDRESS: '0xMarketplace',
          COUPON_ADDRESS: '0xCoupon',
          THB_ADDRESS: '0xTHB',
          VAULT_ADDRESS: '0xVault',
        };
        return map[key];
      }),
    } as any;
    const svc = new BlockchainService(configFull);

    const result = await svc.transferCoupon(
      1,
      2,
      '0xFrom',
      '0xTo',
      '0xPrivateKey',
    );

    expect(result).toBe(mockTxHash);
  });
});
