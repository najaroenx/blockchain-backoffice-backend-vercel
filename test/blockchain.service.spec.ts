jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));
import { BlockchainService } from '../src/providers/blockchain/blockchain.service';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  InternalServerErrorException,
  ServiceUnavailableException,
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
        wait: jest.fn().mockResolvedValue({ status: 1 }),
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

  it('submitCouponTransfer should return the tx hash without waiting for confirmation', async () => {
    const wait = jest.fn().mockResolvedValue({ status: 1 });
    const ethersModule = jest.requireMock('ethers');
    ethersModule.Contract.mockImplementation(() => ({
      safeTransferFrom: jest.fn().mockResolvedValue({
        hash: '0xSubmittedHash',
        wait,
      }),
    }));

    const svc = fullSvc();
    const txHash = await svc.submitCouponTransfer(
      1,
      2,
      '0xFrom',
      '0xTo',
      '0xPrivateKey',
    );

    expect(txHash).toBe('0xSubmittedHash');
    expect(wait).not.toHaveBeenCalled();
  });
});

// ─── helpers ────────────────────────────────────────────────────────────────

const FULL_CONFIG: Record<string, string> = {
  POINT_FACTORY_ADDRESS: '0xFactory',
  PRIVATE_KEY:
    '0xABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789',
  RPC_URL: 'http://localhost:8545',
  MARKETPLACE_ADDRESS: '0xMarketplace',
  COUPON_ADDRESS: '0xCoupon',
  THB_ADDRESS: '0xTHB',
  VAULT_ADDRESS: '0xVault',
};

const makeReceipt = (hash = '0xHash', blockNumber = 100) => ({
  hash,
  blockNumber,
  status: 1,
  logs: [] as any[],
});

const makeTx = (hash = '0xHash', blockNumber = 100) => ({
  hash,
  wait: jest.fn().mockResolvedValue(makeReceipt(hash, blockNumber)),
});

function fullSvc() {
  const cfg = { get: jest.fn((k: string) => FULL_CONFIG[k]) } as any;
  return new BlockchainService(cfg);
}

// ─── handleBlockchainError ───────────────────────────────────────────────────

describe('BlockchainService - handleBlockchainError', () => {
  let svc: BlockchainService;
  let mockEthers: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockEthers = jest.requireMock('ethers');
    svc = fullSvc();
  });

  it('throws ServiceUnavailableException for network_error code', async () => {
    const err: any = new Error('rpc down');
    err.code = 'NETWORK_ERROR';
    mockEthers.Contract.mockImplementationOnce(() => ({
      balanceOf: jest.fn().mockRejectedValue(err),
    }));
    await expect(
      svc.getBalance({ walletAddress: '0xA', pointAddress: '0xP' }),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('throws ServiceUnavailableException for server_error code', async () => {
    const err: any = new Error('server error');
    err.code = 'SERVER_ERROR';
    mockEthers.Contract.mockImplementationOnce(() => ({
      balanceOf: jest.fn().mockRejectedValue(err),
    }));
    await expect(
      svc.getBalance({ walletAddress: '0xA', pointAddress: '0xP' }),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('throws ServiceUnavailableException for could not detect network message', async () => {
    const err: any = new Error('could not detect network');
    mockEthers.Contract.mockImplementationOnce(() => ({
      balanceOf: jest.fn().mockRejectedValue(err),
    }));
    await expect(
      svc.getBalance({ walletAddress: '0xA', pointAddress: '0xP' }),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('throws ServiceUnavailableException for econnrefused message', async () => {
    const err: any = new Error('connect econnrefused');
    mockEthers.Contract.mockImplementationOnce(() => ({
      balanceOf: jest.fn().mockRejectedValue(err),
    }));
    await expect(
      svc.getBalance({ walletAddress: '0xA', pointAddress: '0xP' }),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('throws InternalServerErrorException with fallback message for regular error', async () => {
    const err = new Error('unknown failure');
    mockEthers.Contract.mockImplementationOnce(() => ({
      balanceOf: jest.fn().mockRejectedValue(err),
    }));
    await expect(
      svc.getBalance({ walletAddress: '0xA', pointAddress: '0xP' }),
    ).rejects.toThrow(InternalServerErrorException);
  });
});

// ─── private utility methods ─────────────────────────────────────────────────

describe('BlockchainService - calculateEpochDuration', () => {
  let svc: BlockchainService;
  beforeEach(() => {
    svc = fullSvc();
  });

  it('returns 3600 for days <= 1', () => {
    expect((svc as any).calculateEpochDuration(0.5)).toBe(3600);
  });

  it('returns 43200 for days <= 7', () => {
    expect((svc as any).calculateEpochDuration(3)).toBe(43200);
  });

  it('returns 86400 for days <= 30', () => {
    expect((svc as any).calculateEpochDuration(15)).toBe(86400);
  });

  it('returns 259200 for days <= 90', () => {
    expect((svc as any).calculateEpochDuration(60)).toBe(259200);
  });

  it('returns 604800 for days > 90', () => {
    expect((svc as any).calculateEpochDuration(180)).toBe(604800);
  });
});

describe('BlockchainService - calculateExpiryTimestamp', () => {
  let svc: BlockchainService;
  const now = Math.floor(Date.now() / 1000);

  beforeEach(() => {
    svc = fullSvc();
  });

  it('uses endDate when provided', () => {
    const future = now + 86400 * 100;
    const result = (svc as any).calculateExpiryTimestamp(
      now,
      now,
      undefined,
      future,
      undefined,
    );
    expect(result).toBe(future);
  });

  it('uses expiryMonths when endDate not provided', () => {
    const result = (svc as any).calculateExpiryTimestamp(
      now,
      now,
      undefined,
      undefined,
      3,
    );
    expect(result).toBeGreaterThan(now);
  });

  it('throws when neither endDate nor expiryMonths provided', () => {
    expect(() =>
      (svc as any).calculateExpiryTimestamp(
        now,
        now,
        undefined,
        undefined,
        undefined,
      ),
    ).toThrow('Either endDate or expiryMonths must be provided');
  });
});

describe('BlockchainService - validateAndUseEndDate', () => {
  let svc: BlockchainService;
  const now = Math.floor(Date.now() / 1000);

  beforeEach(() => {
    svc = fullSvc();
  });

  it('throws when endDate <= startDate', () => {
    expect(() =>
      (svc as any).validateAndUseEndDate(now, now + 1000, now + 500),
    ).toThrow('endDate must be greater than startDate');
  });

  it('throws when endDate is in the past', () => {
    expect(() =>
      (svc as any).validateAndUseEndDate(now, undefined, now - 1),
    ).toThrow('endDate must be in the future');
  });

  it('returns endDate when valid with startDate', () => {
    const endDate = now + 86400 * 90;
    const result = (svc as any).validateAndUseEndDate(now, now, endDate);
    expect(result).toBe(endDate);
  });

  it('returns endDate when valid without startDate', () => {
    const endDate = now + 86400 * 90;
    const result = (svc as any).validateAndUseEndDate(now, undefined, endDate);
    expect(result).toBe(endDate);
  });
});

describe('BlockchainService - calculateFromExpiryMonths', () => {
  let svc: BlockchainService;
  const now = Math.floor(Date.now() / 1000);

  beforeEach(() => {
    svc = fullSvc();
  });

  it('throws for invalid month value', () => {
    expect(() =>
      (svc as any).calculateFromExpiryMonths(now, undefined, 5),
    ).toThrow('Invalid expiryMonths');
  });

  it('calculates for 3 months without startDate', () => {
    const result = (svc as any).calculateFromExpiryMonths(now, undefined, 3);
    expect(result).toBeGreaterThan(now);
  });

  it('calculates for 12 months with startDate logging', () => {
    const result = (svc as any).calculateFromExpiryMonths(now, now, 12);
    expect(result).toBeGreaterThan(now);
  });
});

describe('BlockchainService - resolveBlockTime', () => {
  let svc: BlockchainService;
  let mockEthers: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockEthers = jest.requireMock('ethers');
    svc = fullSvc();
  });

  it('returns DEFAULT_BLOCK_TIME when block number is 0', async () => {
    mockEthers.JsonRpcProvider.mockImplementation(() => ({
      getBlockNumber: jest.fn().mockResolvedValue(0),
    }));
    const svc2 = fullSvc();
    const result = await (svc2 as any).resolveBlockTime();
    expect(result).toBe(12);
  });

  it('returns DEFAULT_BLOCK_TIME when provider throws', async () => {
    (svc as any).provider = {
      getBlockNumber: jest.fn().mockRejectedValue(new Error('network')),
    };
    const result = await (svc as any).resolveBlockTime();
    expect(result).toBe(12);
  });

  it('calculates block time from two consecutive blocks', async () => {
    (svc as any).provider = {
      getBlockNumber: jest.fn().mockResolvedValue(10),
      getBlock: jest
        .fn()
        .mockResolvedValueOnce({ timestamp: 1000 })
        .mockResolvedValueOnce({ timestamp: 988 }),
    };
    const result = await (svc as any).resolveBlockTime();
    expect(result).toBe(12);
  });

  it('returns DEFAULT_BLOCK_TIME when blocks are null', async () => {
    (svc as any).provider = {
      getBlockNumber: jest.fn().mockResolvedValue(5),
      getBlock: jest.fn().mockResolvedValue(null),
    };
    const result = await (svc as any).resolveBlockTime();
    expect(result).toBe(12);
  });

  it('returns DEFAULT_BLOCK_TIME when diff <= 0', async () => {
    (svc as any).provider = {
      getBlockNumber: jest.fn().mockResolvedValue(5),
      getBlock: jest
        .fn()
        .mockResolvedValueOnce({ timestamp: 1000 })
        .mockResolvedValueOnce({ timestamp: 1000 }),
    };
    const result = await (svc as any).resolveBlockTime();
    expect(result).toBe(12);
  });
});

// ─── normalizeListingId paths not yet covered ────────────────────────────────

describe('BlockchainService - normalizeListingId via getMarketplaceListing', () => {
  let svc: BlockchainService;
  let mockEthers: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockEthers = jest.requireMock('ethers');
    svc = fullSvc();
  });

  it('accepts bigint listing id', async () => {
    mockEthers.Contract.mockImplementationOnce(() => ({
      getListing: jest.fn().mockResolvedValue({
        seller: '0xS',
        typeId: BigInt(1),
        amount: BigInt(1),
        pricePerUnit: BigInt(0),
        paymentToken: '0xT',
        active: true,
        listedAt: BigInt(0),
      }),
    }));
    const result = await svc.getMarketplaceListing(BigInt(5) as any);
    expect(result.typeId).toBe('1');
  });

  it('accepts numeric listing id', async () => {
    mockEthers.Contract.mockImplementationOnce(() => ({
      getListing: jest.fn().mockResolvedValue({
        seller: '0xS',
        typeId: BigInt(2),
        amount: BigInt(1),
        pricePerUnit: BigInt(0),
        paymentToken: '0xT',
        active: true,
        listedAt: BigInt(0),
      }),
    }));
    const result = await svc.getMarketplaceListing(7 as any);
    expect(result.typeId).toBe('2');
  });

  it('throws BadRequestException for non-integer number', async () => {
    await expect(svc.getMarketplaceListing(1.5 as any)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('handles blockchain error from getListing', async () => {
    mockEthers.Contract.mockImplementationOnce(() => ({
      getListing: jest.fn().mockRejectedValue(new Error('rpc error')),
    }));
    await expect(svc.getMarketplaceListing('1')).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});

// ─── transaction - additional branches ───────────────────────────────────────

describe('BlockchainService - transaction additional paths', () => {
  let svc: BlockchainService;
  let mockEthers: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockEthers = jest.requireMock('ethers');
    svc = fullSvc();
  });

  it('throws InternalServerErrorException when error has reason', async () => {
    const err: any = new Error('tx failed');
    err.reason = 'ERC20: insufficient balance';
    mockEthers.Contract.mockImplementationOnce(() => ({
      connect: jest.fn().mockReturnThis(),
      balanceOf: jest.fn().mockResolvedValue(BigInt(1000)),
      transfer: jest.fn().mockRejectedValue(err),
    }));
    mockEthers.ethers.parseEther.mockReturnValueOnce(BigInt(1));
    await expect(
      svc.transaction({ amount: 1, to: '0xTo', pointAddress: '0xP' }),
    ).rejects.toThrow(InternalServerErrorException);
  });

  it('throws InternalServerErrorException when error has shortMessage', async () => {
    const err: any = new Error('tx failed');
    err.shortMessage = 'execution reverted';
    mockEthers.Contract.mockImplementationOnce(() => ({
      connect: jest.fn().mockReturnThis(),
      balanceOf: jest.fn().mockResolvedValue(BigInt(1000)),
      transfer: jest.fn().mockRejectedValue(err),
    }));
    mockEthers.ethers.parseEther.mockReturnValueOnce(BigInt(1));
    await expect(
      svc.transaction({ amount: 1, to: '0xTo', pointAddress: '0xP' }),
    ).rejects.toThrow(InternalServerErrorException);
  });

  it('throws on insufficient balance', async () => {
    mockEthers.Contract.mockImplementationOnce(() => ({
      connect: jest.fn().mockReturnThis(),
      balanceOf: jest.fn().mockResolvedValue(BigInt(1)),
      transfer: jest.fn(),
    }));
    mockEthers.ethers.parseEther.mockReturnValueOnce(BigInt(1_000_000));
    await expect(
      svc.transaction({ amount: 1000000, to: '0xTo', pointAddress: '0xP' }),
    ).rejects.toThrow(InternalServerErrorException);
  });

  it('uses senderPrivateKey when provided', async () => {
    mockEthers.Contract.mockImplementationOnce(() => ({
      connect: jest.fn().mockReturnThis(),
      balanceOf: jest.fn().mockResolvedValue(BigInt(1000)),
      transfer: jest.fn().mockResolvedValue(makeTx()),
    }));
    mockEthers.ethers.parseEther.mockReturnValueOnce(BigInt(1));
    const result = await svc.transaction({
      amount: 1,
      to: '0xTo',
      pointAddress: '0xP',
      senderPrivateKey: '0xCustomKey',
    });
    expect(result).toHaveProperty('txId');
  });
});

// ─── mint / burn error paths ──────────────────────────────────────────────────

describe('BlockchainService - mint and burn error paths', () => {
  let svc: BlockchainService;
  let mockEthers: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockEthers = jest.requireMock('ethers');
    svc = fullSvc();
  });

  it('mint throws InternalServerErrorException on failure', async () => {
    mockEthers.Contract.mockImplementationOnce(() => ({
      connect: jest.fn().mockReturnThis(),
      mint: jest.fn().mockRejectedValue(new Error('mint failed')),
    }));
    await expect(
      svc.mint({ amount: 1, to: '0xTo', pointAddress: '0xP' }),
    ).rejects.toThrow(InternalServerErrorException);
  });

  it('burn throws InternalServerErrorException on failure', async () => {
    mockEthers.Contract.mockImplementationOnce(() => ({
      connect: jest.fn().mockReturnThis(),
      burn: jest.fn().mockRejectedValue(new Error('burn failed')),
    }));
    await expect(
      svc.burn({ amount: 1, senderPrivateKey: '0xKey', pointAddress: '0xP' }),
    ).rejects.toThrow(InternalServerErrorException);
  });

  it('transactionC2C throws InternalServerErrorException on failure', async () => {
    mockEthers.Contract.mockImplementationOnce(() => ({
      connect: jest.fn().mockReturnThis(),
      transfer: jest.fn().mockRejectedValue(new Error('c2c failed')),
    }));
    await expect(
      svc.transactionC2C({
        amount: 1,
        to: '0xTo',
        senderPrivateKey: '0xKey',
        pointAddress: '0xP',
      }),
    ).rejects.toThrow(InternalServerErrorException);
  });
});

// ─── redeemVoucher ───────────────────────────────────────────────────────────

describe('BlockchainService - redeemVoucher', () => {
  let mockEthers: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockEthers = jest.requireMock('ethers');
  });

  it('throws InternalServerErrorException when no coupon address', async () => {
    const cfg = {
      get: jest.fn((k: string) => ({ ...FULL_CONFIG, COUPON_ADDRESS: '' })[k]),
    } as any;
    const svc = new BlockchainService(cfg);
    await expect(svc.redeemVoucher('1', 1, '0xOwner')).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  it('redeems successfully', async () => {
    const receipt = makeReceipt('0xRedeemHash');
    mockEthers.Contract.mockImplementationOnce(() => ({
      redeem: jest.fn().mockResolvedValue({
        wait: jest.fn().mockResolvedValue(receipt),
      }),
    }));
    const svc = fullSvc();
    const result = await svc.redeemVoucher('1', 1, '0xOwner', '0xKey');
    expect(result).toMatchObject({
      hash: '0xRedeemHash',
      blockNumber: 100,
      status: 1,
    });
  });

  it('throws InternalServerErrorException on blockchain error', async () => {
    mockEthers.Contract.mockImplementationOnce(() => ({
      redeem: jest.fn().mockRejectedValue(new Error('reverted')),
    }));
    const svc = fullSvc();
    await expect(svc.redeemVoucher('1', 1, '0xOwner')).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});

// ─── getVoucherData ───────────────────────────────────────────────────────────

describe('BlockchainService - getVoucherData', () => {
  let mockEthers: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockEthers = jest.requireMock('ethers');
  });

  it('throws when VOUCHER_CONTRACT_ADDRESS not configured', async () => {
    const svc = fullSvc();
    await expect(svc.getVoucherData('1')).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  it('returns voucher data when contract responds', async () => {
    mockEthers.Contract.mockImplementationOnce(() => ({
      getVoucherData: jest.fn().mockResolvedValue(['CODE123', false]),
    }));
    const cfg = {
      get: jest.fn(
        (k: string) =>
          ({ ...FULL_CONFIG, VOUCHER_CONTRACT_ADDRESS: '0xVoucher' })[k],
      ),
    } as any;
    const svc = new BlockchainService(cfg);
    const result = await svc.getVoucherData('42');
    expect(result).toEqual({
      tokenId: '42',
      redeemCode: 'CODE123',
      isRedeemed: false,
    });
  });
});

// ─── mintVoucher ─────────────────────────────────────────────────────────────

describe('BlockchainService - mintVoucher', () => {
  let mockEthers: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockEthers = jest.requireMock('ethers');
  });

  it('throws when VOUCHER_CONTRACT_ADDRESS not configured', async () => {
    const svc = fullSvc();
    await expect(svc.mintVoucher('0xTo', 'CODE1')).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  it('mints successfully and parses VoucherMinted event', async () => {
    const mockInterface = {
      parseLog: jest.fn().mockReturnValue({
        name: 'VoucherMinted',
        args: { tokenId: { toString: () => '99' } },
      }),
    };
    const receipt = {
      hash: '0xMintHash',
      blockNumber: 5,
      logs: [{ address: '0xVoucher' }],
    };
    mockEthers.Contract.mockImplementationOnce(() => ({
      mint: jest
        .fn()
        .mockResolvedValue({ wait: jest.fn().mockResolvedValue(receipt) }),
      interface: mockInterface,
    }));
    const cfg = {
      get: jest.fn(
        (k: string) =>
          ({ ...FULL_CONFIG, VOUCHER_CONTRACT_ADDRESS: '0xVoucher' })[k],
      ),
    } as any;
    const svc = new BlockchainService(cfg);
    const result = await svc.mintVoucher('0xTo', 'CODE1');
    expect(result).toMatchObject({ tokenId: '99', hash: '0xMintHash' });
  });

  it('mints without matching event (tokenId = null)', async () => {
    const mockInterface = {
      parseLog: jest.fn().mockReturnValue({ name: 'OtherEvent', args: {} }),
    };
    const receipt = {
      hash: '0xMintHash2',
      blockNumber: 6,
      logs: [{}],
    };
    mockEthers.Contract.mockImplementationOnce(() => ({
      mint: jest
        .fn()
        .mockResolvedValue({ wait: jest.fn().mockResolvedValue(receipt) }),
      interface: mockInterface,
    }));
    const cfg = {
      get: jest.fn(
        (k: string) =>
          ({ ...FULL_CONFIG, VOUCHER_CONTRACT_ADDRESS: '0xVoucher' })[k],
      ),
    } as any;
    const svc = new BlockchainService(cfg);
    const result = await svc.mintVoucher('0xTo', 'CODE2');
    expect(result?.tokenId).toBeNull();
  });
});

// ─── batchMintVouchers ───────────────────────────────────────────────────────

describe('BlockchainService - batchMintVouchers', () => {
  let mockEthers: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockEthers = jest.requireMock('ethers');
  });

  it('throws when VOUCHER_CONTRACT_ADDRESS not configured', async () => {
    const svc = fullSvc();
    await expect(svc.batchMintVouchers('0xTo', ['A', 'B'])).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  it('batch mints successfully', async () => {
    const receipt = { hash: '0xBatchHash', blockNumber: 7 };
    mockEthers.Contract.mockImplementationOnce(() => ({
      batchMint: jest
        .fn()
        .mockResolvedValue({ wait: jest.fn().mockResolvedValue(receipt) }),
    }));
    const cfg = {
      get: jest.fn(
        (k: string) =>
          ({ ...FULL_CONFIG, VOUCHER_CONTRACT_ADDRESS: '0xVoucher' })[k],
      ),
    } as any;
    const svc = new BlockchainService(cfg);
    const result = await svc.batchMintVouchers('0xTo', ['A', 'B']);
    expect(result).toMatchObject({ hash: '0xBatchHash', count: 2 });
  });
});

// ─── createCouponType ────────────────────────────────────────────────────────

describe('BlockchainService - createCouponType', () => {
  let mockEthers: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockEthers = jest.requireMock('ethers');
  });

  it('throws when no coupon address', async () => {
    const cfg = {
      get: jest.fn((k: string) => ({ ...FULL_CONFIG, COUPON_ADDRESS: '' })[k]),
    } as any;
    const svc = new BlockchainService(cfg);
    await expect(svc.createCouponType('name', 1000, 2000)).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  it('creates coupon type successfully', async () => {
    const receipt = {
      hash: '0xCTHash',
      blockNumber: 10,
      logs: [{}],
    };
    const mockInterface = {
      parseLog: jest.fn().mockReturnValue({
        name: 'CouponTypeCreated',
        args: { typeId: { toString: () => '7' } },
      }),
    };
    mockEthers.Contract.mockImplementationOnce(() => ({
      createCouponType: jest
        .fn()
        .mockResolvedValue({ wait: jest.fn().mockResolvedValue(receipt) }),
      interface: mockInterface,
    }));
    const svc = fullSvc();
    const result = await svc.createCouponType('VoucherA', 1000, 2000);
    expect(result).toMatchObject({ typeId: '7', hash: '0xCTHash' });
  });

  it('throws when CouponTypeCreated event not found in logs', async () => {
    const receipt = { hash: '0xCTHash2', blockNumber: 11, logs: [] };
    mockEthers.Contract.mockImplementationOnce(() => ({
      createCouponType: jest
        .fn()
        .mockResolvedValue({ wait: jest.fn().mockResolvedValue(receipt) }),
      interface: { parseLog: jest.fn().mockReturnValue(null) },
    }));
    const svc = fullSvc();
    await expect(svc.createCouponType('VoucherB', 1000, 2000)).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});

// ─── mintCoupon ───────────────────────────────────────────────────────────────

describe('BlockchainService - mintCoupon', () => {
  let mockEthers: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockEthers = jest.requireMock('ethers');
  });

  it('throws when no coupon address', async () => {
    const cfg = {
      get: jest.fn((k: string) => ({ ...FULL_CONFIG, COUPON_ADDRESS: '' })[k]),
    } as any;
    const svc = new BlockchainService(cfg);
    await expect(svc.mintCoupon('0xTo', '1', 5)).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  it('mints coupon successfully', async () => {
    const receipt = { hash: '0xMCHash', blockNumber: 12 };
    mockEthers.Contract.mockImplementationOnce(() => ({
      mint: jest
        .fn()
        .mockResolvedValue({ wait: jest.fn().mockResolvedValue(receipt) }),
    }));
    const svc = fullSvc();
    const result = await svc.mintCoupon('0xTo', '1', 5);
    expect(result).toMatchObject({ hash: '0xMCHash', blockNumber: 12 });
  });
});

// ─── batchMintCoupons ────────────────────────────────────────────────────────

describe('BlockchainService - batchMintCoupons', () => {
  let mockEthers: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockEthers = jest.requireMock('ethers');
  });

  it('throws for array length mismatch', async () => {
    const svc = fullSvc();
    await expect(
      svc.batchMintCoupons(['0xA'], ['1', '2'], [1]),
    ).rejects.toThrow(InternalServerErrorException);
  });

  it('throws when no coupon address', async () => {
    const cfg = {
      get: jest.fn((k: string) => ({ ...FULL_CONFIG, COUPON_ADDRESS: '' })[k]),
    } as any;
    const svc = new BlockchainService(cfg);
    await expect(svc.batchMintCoupons(['0xA'], ['1'], [1])).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  it('batch mints coupons successfully', async () => {
    const receipt = { hash: '0xBMCHash', blockNumber: 13 };
    mockEthers.Contract.mockImplementationOnce(() => ({
      batchMint: jest
        .fn()
        .mockResolvedValue({ wait: jest.fn().mockResolvedValue(receipt) }),
    }));
    const svc = fullSvc();
    const result = await svc.batchMintCoupons(
      ['0xA', '0xB'],
      ['1', '2'],
      [1, 2],
    );
    expect(result).toMatchObject({ hash: '0xBMCHash' });
  });
});

// ─── getAllActiveMarketplaceListings cache miss ───────────────────────────────

describe('BlockchainService - getAllActiveMarketplaceListings cache miss', () => {
  let svc: BlockchainService;
  let mockEthers: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockEthers = jest.requireMock('ethers');
    svc = fullSvc();
    (svc as any).listingsCache = null;
  });

  it('fetches from contract and caches result', async () => {
    const listing = {
      seller: '0xSeller',
      typeId: { toString: () => '1' },
      amount: { toString: () => '5' },
      pricePerUnit: { toString: () => '0' },
      paymentToken: '0xToken',
      active: true,
      listedAt: { toString: () => '0' },
    };
    mockEthers.Contract.mockImplementationOnce(() => ({
      getActiveListings: jest.fn().mockResolvedValue([BigInt(3)]),
      getAllActiveListings: jest.fn().mockResolvedValue([listing]),
    }));
    const result = await svc.getAllActiveMarketplaceListings();
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty('listingId', '3');
    expect((svc as any).listingsCache).not.toBeNull();
  });

  it('throws on blockchain error (cache miss)', async () => {
    mockEthers.Contract.mockImplementationOnce(() => ({
      getActiveListings: jest.fn().mockRejectedValue(new Error('rpc fail')),
      getAllActiveListings: jest.fn(),
    }));
    await expect(svc.getAllActiveMarketplaceListings()).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});

// ─── invalidateListingsCache - when cache is populated ───────────────────────

describe('BlockchainService - invalidateListingsCache with data', () => {
  it('logs and clears when cache exists', () => {
    const svc = fullSvc();
    (svc as any).listingsCache = {
      data: [{ listingId: '1' }],
      timestamp: Date.now(),
    };
    svc.invalidateListingsCache();
    expect((svc as any).listingsCache).toBeNull();
  });
});

// ─── delistCoupon ────────────────────────────────────────────────────────────

describe('BlockchainService - delistCoupon', () => {
  let mockEthers: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockEthers = jest.requireMock('ethers');
  });

  it('throws when no marketplace address', async () => {
    const cfg = {
      get: jest.fn(
        (k: string) => ({ ...FULL_CONFIG, MARKETPLACE_ADDRESS: '' })[k],
      ),
    } as any;
    const svc = new BlockchainService(cfg);
    await expect(svc.delistCoupon('1', '0xKey')).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  it('delists successfully and invalidates cache', async () => {
    const receipt = { hash: '0xDelistHash', blockNumber: 14 };
    mockEthers.Contract.mockImplementationOnce(() => ({
      delistCoupon: jest
        .fn()
        .mockResolvedValue({ wait: jest.fn().mockResolvedValue(receipt) }),
    }));
    const svc = fullSvc();
    (svc as any).listingsCache = { data: [], timestamp: Date.now() };
    const result = await svc.delistCoupon('1', '0xKey');
    expect(result).toMatchObject({ hash: '0xDelistHash' });
    expect((svc as any).listingsCache).toBeNull();
  });
});

// ─── mintTHB ─────────────────────────────────────────────────────────────────

describe('BlockchainService - mintTHB', () => {
  let mockEthers: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockEthers = jest.requireMock('ethers');
  });

  it('throws when no THB address', async () => {
    const cfg = {
      get: jest.fn((k: string) => ({ ...FULL_CONFIG, THB_ADDRESS: '' })[k]),
    } as any;
    const svc = new BlockchainService(cfg);
    await expect(svc.mintTHB('0xTo', BigInt(100))).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  it('mints THB successfully', async () => {
    const receipt = { hash: '0xTHBHash', blockNumber: 15 };
    mockEthers.Contract.mockImplementationOnce(() => ({
      mint: jest
        .fn()
        .mockResolvedValue({ wait: jest.fn().mockResolvedValue(receipt) }),
    }));
    const svc = fullSvc();
    const result = await svc.mintTHB('0xTo', BigInt(100));
    expect(result).toMatchObject({ hash: '0xTHBHash' });
  });
});

// ─── approveTHB ──────────────────────────────────────────────────────────────

describe('BlockchainService - approveTHB', () => {
  let mockEthers: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockEthers = jest.requireMock('ethers');
  });

  it('throws when no THB address', async () => {
    const cfg = {
      get: jest.fn((k: string) => ({ ...FULL_CONFIG, THB_ADDRESS: '' })[k]),
    } as any;
    const svc = new BlockchainService(cfg);
    await expect(svc.approveTHB('0xSpender', BigInt(100))).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  it('approves with default (admin) private key', async () => {
    const receipt = { hash: '0xApprHash', blockNumber: 16 };
    mockEthers.Contract.mockImplementationOnce(() => ({
      approve: jest
        .fn()
        .mockResolvedValue({ wait: jest.fn().mockResolvedValue(receipt) }),
    }));
    const svc = fullSvc();
    const result = await svc.approveTHB('0xSpender', BigInt(100));
    expect(result).toMatchObject({ hash: '0xApprHash' });
  });

  it('approves with ownerPrivateKey', async () => {
    const receipt = { hash: '0xApprHash2', blockNumber: 17 };
    mockEthers.Contract.mockImplementationOnce(() => ({
      approve: jest
        .fn()
        .mockResolvedValue({ wait: jest.fn().mockResolvedValue(receipt) }),
    }));
    const svc = fullSvc();
    const result = await svc.approveTHB('0xSpender', BigInt(100), '0xOwnerKey');
    expect(result).toMatchObject({ hash: '0xApprHash2' });
  });
});

// ─── getVaultContract ────────────────────────────────────────────────────────

describe('BlockchainService - getVaultContract', () => {
  it('throws when no vault address configured', () => {
    const cfg = {
      get: jest.fn((k: string) => ({ ...FULL_CONFIG, VAULT_ADDRESS: '' })[k]),
    } as any;
    const svc = new BlockchainService(cfg);
    expect(() => (svc as any).getVaultContract()).toThrow(
      'VAULT_ADDRESS not configured',
    );
  });
});

// ─── getMarketplaceContract - no address ─────────────────────────────────────

describe('BlockchainService - getMarketplaceContract', () => {
  it('throws when no marketplace address configured', () => {
    const cfg = {
      get: jest.fn(
        (k: string) =>
          ({
            ...FULL_CONFIG,
            MARKETPLACE_ADDRESS: '',
          })[k],
      ),
    } as any;
    const svc = new BlockchainService(cfg);
    expect(() => (svc as any).getMarketplaceContract()).toThrow(
      'MARKETPLACE_ADDRESS not configured',
    );
  });
});

// ─── hasActiveVaultEscrow ────────────────────────────────────────────────────

describe('BlockchainService - hasActiveVaultEscrow', () => {
  let mockEthers: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockEthers = jest.requireMock('ethers');
  });

  it('returns false when no vault address', async () => {
    const cfg = {
      get: jest.fn((k: string) => ({ ...FULL_CONFIG, VAULT_ADDRESS: '' })[k]),
    } as any;
    const svc = new BlockchainService(cfg);
    const result = await svc.hasActiveVaultEscrow('tokenId');
    expect(result).toBe(false);
  });

  it('returns true when escrow active', async () => {
    mockEthers.Contract.mockImplementationOnce(() => ({
      hasActiveEscrow: jest.fn().mockResolvedValue(true),
    }));
    const svc = fullSvc();
    expect(await svc.hasActiveVaultEscrow('tokenId')).toBe(true);
  });

  it('returns false when no active escrow', async () => {
    mockEthers.Contract.mockImplementationOnce(() => ({
      hasActiveEscrow: jest.fn().mockResolvedValue(false),
    }));
    const svc = fullSvc();
    expect(await svc.hasActiveVaultEscrow('tokenId')).toBe(false);
  });

  it('throws InternalServerErrorException on blockchain error', async () => {
    mockEthers.Contract.mockImplementationOnce(() => ({
      hasActiveEscrow: jest.fn().mockRejectedValue(new Error('rpc down')),
    }));
    const svc = fullSvc();
    await expect(svc.hasActiveVaultEscrow('tokenId')).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});

// ─── releaseVaultFundsPartial ────────────────────────────────────────────────

describe('BlockchainService - releaseVaultFundsPartial', () => {
  let mockEthers: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockEthers = jest.requireMock('ethers');
  });

  it('releases funds successfully', async () => {
    const receipt = { hash: '0xReleaseHash', blockNumber: 18 };
    mockEthers.Contract.mockImplementationOnce(() => ({
      releaseFundsPartial: jest
        .fn()
        .mockResolvedValue({ wait: jest.fn().mockResolvedValue(receipt) }),
    }));
    const svc = fullSvc();
    const result = await svc.releaseVaultFundsPartial('tokenId', 3);
    expect(result).toMatchObject({ hash: '0xReleaseHash' });
  });

  it('throws InternalServerErrorException on error', async () => {
    mockEthers.Contract.mockImplementationOnce(() => ({
      releaseFundsPartial: jest
        .fn()
        .mockRejectedValue(new Error('vault error')),
    }));
    const svc = fullSvc();
    await expect(svc.releaseVaultFundsPartial('tokenId', 1)).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});

// ─── lockFundsForCouponType - validation ─────────────────────────────────────

describe('BlockchainService - lockFundsForCouponType validation', () => {
  let svc: BlockchainService;

  beforeEach(() => {
    svc = fullSvc();
  });

  it('throws when tokenId is missing', async () => {
    await expect(
      svc.lockFundsForCouponType('', '0xSeller', 10, 5),
    ).rejects.toThrow(InternalServerErrorException);
  });

  it('throws when sellerAddress is missing', async () => {
    await expect(
      svc.lockFundsForCouponType('tokenId', '', 10, 5),
    ).rejects.toThrow(InternalServerErrorException);
  });

  it('throws when pricePerUnitTHB <= 0', async () => {
    await expect(
      svc.lockFundsForCouponType('tokenId', '0xSeller', 0, 5),
    ).rejects.toThrow(InternalServerErrorException);
  });

  it('throws when totalIssued <= 0', async () => {
    await expect(
      svc.lockFundsForCouponType('tokenId', '0xSeller', 10, 0),
    ).rejects.toThrow(InternalServerErrorException);
  });

  it('throws when no vault address', async () => {
    const cfg = {
      get: jest.fn((k: string) => ({ ...FULL_CONFIG, VAULT_ADDRESS: '' })[k]),
    } as any;
    const svc2 = new BlockchainService(cfg);
    await expect(
      svc2.lockFundsForCouponType('tokenId', '0xSeller', 10, 5),
    ).rejects.toThrow(InternalServerErrorException);
  });
});

// ─── addToMarketplaceWhitelist ───────────────────────────────────────────────

describe('BlockchainService - addToMarketplaceWhitelist', () => {
  let mockEthers: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockEthers = jest.requireMock('ethers');
  });

  it('throws when no marketplace address', async () => {
    const cfg = {
      get: jest.fn(
        (k: string) =>
          ({
            ...FULL_CONFIG,
            MARKETPLACE_ADDRESS: '',
          })[k],
      ),
    } as any;
    const svc = new BlockchainService(cfg);
    await expect(svc.addToMarketplaceWhitelist('0xAddr')).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  it('whitelists address successfully', async () => {
    const receipt = { hash: '0xWLHash', blockNumber: 19 };
    mockEthers.Contract.mockImplementationOnce(() => ({
      addToWhitelist: jest
        .fn()
        .mockResolvedValue({ wait: jest.fn().mockResolvedValue(receipt) }),
    }));
    const svc = fullSvc();
    const result = await svc.addToMarketplaceWhitelist('0xAddr');
    expect(result).toMatchObject({ hash: '0xWLHash' });
  });
});

// ─── batchAddToMarketplaceWhitelist ──────────────────────────────────────────

describe('BlockchainService - batchAddToMarketplaceWhitelist', () => {
  let mockEthers: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockEthers = jest.requireMock('ethers');
  });

  it('throws when no marketplace address', async () => {
    const cfg = {
      get: jest.fn(
        (k: string) =>
          ({
            ...FULL_CONFIG,
            MARKETPLACE_ADDRESS: '',
          })[k],
      ),
    } as any;
    const svc = new BlockchainService(cfg);
    await expect(
      svc.batchAddToMarketplaceWhitelist(['0xA', '0xB']),
    ).rejects.toThrow(InternalServerErrorException);
  });

  it('batch whitelists successfully', async () => {
    const receipt = { hash: '0xBWLHash', blockNumber: 20 };
    mockEthers.Contract.mockImplementationOnce(() => ({
      batchAddToWhitelist: jest
        .fn()
        .mockResolvedValue({ wait: jest.fn().mockResolvedValue(receipt) }),
    }));
    const svc = fullSvc();
    const result = await svc.batchAddToMarketplaceWhitelist(['0xA', '0xB']);
    expect(result).toMatchObject({ hash: '0xBWLHash' });
  });
});

// ─── isWhitelisted ───────────────────────────────────────────────────────────

describe('BlockchainService - isWhitelisted', () => {
  let mockEthers: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockEthers = jest.requireMock('ethers');
  });

  it('throws when no marketplace address', async () => {
    const cfg = {
      get: jest.fn(
        (k: string) =>
          ({
            ...FULL_CONFIG,
            MARKETPLACE_ADDRESS: '',
          })[k],
      ),
    } as any;
    const svc = new BlockchainService(cfg);
    await expect(svc.isWhitelisted('0xAddr')).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  it('returns true when address is whitelisted', async () => {
    mockEthers.Contract.mockImplementationOnce(() => ({
      whitelist: jest.fn().mockResolvedValue(true),
    }));
    const svc = fullSvc();
    expect(await svc.isWhitelisted('0xAddr')).toBe(true);
  });

  it('returns false when address is not whitelisted', async () => {
    mockEthers.Contract.mockImplementationOnce(() => ({
      whitelist: jest.fn().mockResolvedValue(false),
    }));
    const svc = fullSvc();
    expect(await svc.isWhitelisted('0xAddr')).toBe(false);
  });
});

// ─── getUserTHBBalance error path ─────────────────────────────────────────────

describe('BlockchainService - getUserTHBBalance error', () => {
  let mockEthers: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockEthers = jest.requireMock('ethers');
  });

  it('throws InternalServerErrorException on error', async () => {
    mockEthers.Contract.mockImplementationOnce(() => ({
      balanceOf: jest.fn().mockRejectedValue(new Error('thb rpc fail')),
    }));
    const svc = fullSvc();
    await expect(svc.getUserTHBBalance('0xUser')).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});

// ─── getUserCouponBalance / Batch error paths ─────────────────────────────────

describe('BlockchainService - getUserCouponBalance error', () => {
  let mockEthers: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockEthers = jest.requireMock('ethers');
  });

  it('throws InternalServerErrorException on error', async () => {
    mockEthers.Contract.mockImplementationOnce(() => ({
      balanceOf: jest.fn().mockRejectedValue(new Error('coupon rpc fail')),
    }));
    const svc = fullSvc();
    await expect(svc.getUserCouponBalance('0xUser', 1)).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});

describe('BlockchainService - getUserCouponBalanceBatch error', () => {
  let mockEthers: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockEthers = jest.requireMock('ethers');
  });

  it('throws InternalServerErrorException on error', async () => {
    mockEthers.Contract.mockImplementationOnce(() => ({
      balanceOfBatch: jest.fn().mockRejectedValue(new Error('batch rpc fail')),
    }));
    const svc = fullSvc();
    await expect(
      svc.getUserCouponBalanceBatch('0xUser', [1, 2]),
    ).rejects.toThrow(InternalServerErrorException);
  });
});

// ─── transferCoupon error path ────────────────────────────────────────────────

describe('BlockchainService - transferCoupon error', () => {
  let mockEthers: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockEthers = jest.requireMock('ethers');
  });

  it('throws plain Error (not InternalServerErrorException) on failure', async () => {
    mockEthers.Contract.mockImplementation(() => ({
      safeTransferFrom: jest
        .fn()
        .mockRejectedValue(new Error('transfer reverted')),
    }));
    const svc = fullSvc();
    await expect(
      svc.transferCoupon(1, 2, '0xFrom', '0xTo', '0xKey'),
    ).rejects.toThrow('Failed to transfer coupon');
  });
});

// ─── listCoupon ───────────────────────────────────────────────────────────────

describe('BlockchainService - listCoupon', () => {
  let mockEthers: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockEthers = jest.requireMock('ethers');
  });

  it('throws when no marketplace address', async () => {
    const cfg = {
      get: jest.fn(
        (k: string) =>
          ({
            ...FULL_CONFIG,
            MARKETPLACE_ADDRESS: '',
          })[k],
      ),
    } as any;
    const svc = new BlockchainService(cfg);
    await expect(svc.listCoupon('1', 1, '1.0')).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  it('lists coupon when marketplace already approved (topic extraction)', async () => {
    const COUPON_LISTED_SIG =
      '0xe694c172c6060c783e16922da96667b80fac2b705fc5972a8712212db8fe0b70';
    const receipt = {
      hash: '0xListHash',
      blockNumber: 21,
      status: 1,
      logs: [
        {
          address: '0xMarketplace',
          topics: [
            COUPON_LISTED_SIG,
            '0x' + BigInt(42).toString(16).padStart(64, '0'),
          ],
          data: '0x',
        },
      ],
    };

    // Contract 1: coupon contract for isApprovedForAll (returns true → skip approve)
    const mockCouponApproval = {
      isApprovedForAll: jest.fn().mockResolvedValue(true),
    };
    // Contract 2: marketplace contract for listCoupon
    const mockMarketplace = {
      listCoupon: jest
        .fn()
        .mockResolvedValue({ wait: jest.fn().mockResolvedValue(receipt) }),
      interface: { parseLog: jest.fn().mockReturnValue(null) },
    };

    mockEthers.Contract.mockImplementationOnce(
      () => mockCouponApproval,
    ).mockImplementationOnce(() => mockMarketplace);
    mockEthers.ethers.parseEther.mockReturnValueOnce(BigInt(1));

    const svc = fullSvc();
    const result = await svc.listCoupon('1', 1, '1.0', '0xSellerKey');
    expect(result).toMatchObject({ listingId: '42', hash: '0xListHash' });
  });

  it('lists coupon and approves marketplace when not yet approved', async () => {
    const COUPON_LISTED_SIG =
      '0xe694c172c6060c783e16922da96667b80fac2b705fc5972a8712212db8fe0b70';
    const receipt = {
      hash: '0xListHash2',
      blockNumber: 22,
      status: 1,
      logs: [
        {
          address: '0xMarketplace',
          topics: [
            COUPON_LISTED_SIG,
            '0x' + BigInt(55).toString(16).padStart(64, '0'),
          ],
          data: '0x',
        },
      ],
    };
    const approveReceipt = { hash: '0xApprHash' };
    const mockCouponApproval = {
      isApprovedForAll: jest.fn().mockResolvedValue(false),
      setApprovalForAll: jest.fn().mockResolvedValue({
        wait: jest.fn().mockResolvedValue(approveReceipt),
      }),
    };
    const mockMarketplace = {
      listCoupon: jest
        .fn()
        .mockResolvedValue({ wait: jest.fn().mockResolvedValue(receipt) }),
      interface: { parseLog: jest.fn().mockReturnValue(null) },
    };

    mockEthers.Contract.mockImplementationOnce(
      () => mockCouponApproval,
    ).mockImplementationOnce(() => mockMarketplace);
    mockEthers.ethers.parseEther.mockReturnValueOnce(BigInt(1));

    const svc = fullSvc();
    const result = await svc.listCoupon('1', 1, '1.0', '0xSellerKey');
    expect(result).toMatchObject({ listingId: '55' });
    expect(mockCouponApproval.setApprovalForAll).toHaveBeenCalledWith(
      '0xMarketplace',
      true,
      expect.any(Object),
    );
  });

  it('falls back to parseLog for listingId when topic extraction fails', async () => {
    const receipt = {
      hash: '0xListHash3',
      blockNumber: 23,
      status: 1,
      logs: [{ address: '0xOther', topics: [], data: '0x' }],
    };
    const mockCouponApproval = {
      isApprovedForAll: jest.fn().mockResolvedValue(true),
    };
    const mockMarketplace = {
      listCoupon: jest
        .fn()
        .mockResolvedValue({ wait: jest.fn().mockResolvedValue(receipt) }),
      interface: {
        parseLog: jest.fn().mockReturnValue({
          name: 'CouponListed',
          args: { listingId: { toString: () => '77' } },
        }),
      },
    };

    mockEthers.Contract.mockImplementationOnce(
      () => mockCouponApproval,
    ).mockImplementationOnce(() => mockMarketplace);
    mockEthers.ethers.parseEther.mockReturnValueOnce(BigInt(1));

    const svc = fullSvc();
    const result = await svc.listCoupon('1', 1, '1.0');
    expect(result).toMatchObject({ listingId: '77' });
  });

  it('falls back to getActiveListings when both extractions fail', async () => {
    const receipt = {
      hash: '0xListHash4',
      blockNumber: 24,
      status: 1,
      logs: [],
    };
    const mockCouponApproval = {
      isApprovedForAll: jest.fn().mockResolvedValue(true),
    };
    const mockMarketplace = {
      listCoupon: jest
        .fn()
        .mockResolvedValue({ wait: jest.fn().mockResolvedValue(receipt) }),
      interface: { parseLog: jest.fn().mockReturnValue(null) },
      getActiveListings: jest.fn().mockResolvedValue([BigInt(88)]),
    };

    mockEthers.Contract.mockImplementationOnce(
      () => mockCouponApproval,
    ).mockImplementationOnce(() => mockMarketplace);
    mockEthers.ethers.parseEther.mockReturnValueOnce(BigInt(1));

    const svc = fullSvc();
    const result = await svc.listCoupon('1', 1, '1.0');
    expect(result).toMatchObject({ listingId: '88' });
  });

  it('throws when all extraction methods fail', async () => {
    const receipt = {
      hash: '0xListHash5',
      blockNumber: 25,
      status: 1,
      logs: [],
    };
    const mockCouponApproval = {
      isApprovedForAll: jest.fn().mockResolvedValue(true),
    };
    const mockMarketplace = {
      listCoupon: jest
        .fn()
        .mockResolvedValue({ wait: jest.fn().mockResolvedValue(receipt) }),
      interface: { parseLog: jest.fn().mockReturnValue(null) },
      getActiveListings: jest.fn().mockResolvedValue([]),
    };

    mockEthers.Contract.mockImplementationOnce(
      () => mockCouponApproval,
    ).mockImplementationOnce(() => mockMarketplace);
    mockEthers.ethers.parseEther.mockReturnValueOnce(BigInt(1));

    const svc = fullSvc();
    await expect(svc.listCoupon('1', 1, '1.0')).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});

// ─── buyCoupon - error paths ──────────────────────────────────────────────────

describe('BlockchainService - buyCoupon error paths', () => {
  let mockEthers: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockEthers = jest.requireMock('ethers');
  });

  it('throws when no marketplace address', async () => {
    const cfg = {
      get: jest.fn(
        (k: string) =>
          ({
            ...FULL_CONFIG,
            MARKETPLACE_ADDRESS: '',
          })[k],
      ),
    } as any;
    const svc = new BlockchainService(cfg);
    await expect(svc.buyCoupon('1', 1, '0xKey')).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  it('throws when no vault address', async () => {
    const cfg = {
      get: jest.fn((k: string) => ({ ...FULL_CONFIG, VAULT_ADDRESS: '' })[k]),
    } as any;
    const svc = new BlockchainService(cfg);
    await expect(svc.buyCoupon('1', 1, '0xKey')).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  it('throws when listing is not active', async () => {
    // Contract 1: getMarketplaceContract(signer) - for whitelist & buyCoupon
    const mockMarketplace = { whitelist: jest.fn(), buyCoupon: jest.fn() };
    // Contract 2: readMarketplaceListing → getMarketplaceContract(signer)
    const mockListingContract = {
      getListing: jest.fn().mockResolvedValue({
        seller: '0xSeller',
        typeId: BigInt(1),
        amount: BigInt(5),
        pricePerUnit: BigInt(100),
        paymentToken: '0xTHB',
        active: false,
        listedAt: BigInt(0),
      }),
    };
    mockEthers.Contract.mockImplementationOnce(
      () => mockMarketplace,
    ).mockImplementationOnce(() => mockListingContract);

    const svc = fullSvc();
    await expect(svc.buyCoupon('1', 1, '0xKey')).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  it('throws when buyer is the seller', async () => {
    // Wallet mock returns address '0xWallet', listing seller = '0xWallet' (same)
    const mockMarketplace = { whitelist: jest.fn().mockResolvedValue(true) };
    const mockListingContract = {
      getListing: jest.fn().mockResolvedValue({
        seller: '0xWallet', // same as signer.address
        typeId: BigInt(1),
        amount: BigInt(5),
        pricePerUnit: BigInt(100),
        paymentToken: '0xTHB',
        active: true,
        listedAt: BigInt(0),
      }),
    };
    const mockPayment = {
      balanceOf: jest.fn().mockResolvedValue(BigInt(1000)),
    };
    const mockCoupon = { balanceOf: jest.fn().mockResolvedValue(10) };

    mockEthers.Contract.mockImplementationOnce(() => mockMarketplace)
      .mockImplementationOnce(() => mockListingContract)
      .mockImplementationOnce(() => mockPayment)
      .mockImplementationOnce(() => mockCoupon);

    const svc = fullSvc();
    await expect(svc.buyCoupon('1', 1, '0xKey')).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
