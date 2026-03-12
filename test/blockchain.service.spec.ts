jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));
import { BlockchainService } from '../src/providers/blockchain/blockchain.service';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';

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
});
