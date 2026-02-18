jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));
import { InternalServerErrorException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { GetThbBalance } from '../src/modules/internal/wallet/handlers/getThbBalance.handler';
import { BlockchainService } from '../src/providers/blockchain/blockchain.service';
import { ConfigService } from '@nestjs/config';

describe('GetThbBalance', () => {
  let handler: GetThbBalance;
  let blockchainService: jest.Mocked<BlockchainService>;

  beforeEach(async () => {
    const mockBlockchain = { getBalance: jest.fn() };
    const mockConfig = {
      get: jest.fn().mockReturnValue('0xTHB_TOKEN_ADDRESS'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetThbBalance,
        { provide: BlockchainService, useValue: mockBlockchain },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    handler = module.get<GetThbBalance>(GetThbBalance);
    blockchainService = module.get(
      BlockchainService,
    ) as jest.Mocked<BlockchainService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should return THB balance successfully', async () => {
    blockchainService.getBalance.mockResolvedValue({ balance: '500' } as any);

    const result = await handler.execute('0xWalletAddress');

    expect(blockchainService.getBalance).toHaveBeenCalledWith({
      walletAddress: '0xWalletAddress',
      pointAddress: '0xTHB_TOKEN_ADDRESS',
    });
    expect(result).toEqual({
      walletAddress: '0xWalletAddress',
      currency: 'THB',
      balance: '500',
    });
  });

  it('should throw InternalServerErrorException on blockchain error', async () => {
    blockchainService.getBalance.mockRejectedValue(new Error('RPC failed'));

    await expect(handler.execute('0xWalletAddress')).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  it('should re-throw errors that already have status', async () => {
    const httpError = new InternalServerErrorException('Already formatted');
    blockchainService.getBalance.mockRejectedValue(httpError);

    await expect(handler.execute('0xWalletAddress')).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});

describe('GetThbBalance - no THB_ADDRESS configured', () => {
  let handler: GetThbBalance;

  beforeEach(async () => {
    const mockBlockchain = { getBalance: jest.fn() };
    const mockConfig = {
      get: jest.fn().mockReturnValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetThbBalance,
        { provide: BlockchainService, useValue: mockBlockchain },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    handler = module.get<GetThbBalance>(GetThbBalance);
  });

  it('should throw InternalServerErrorException when THB_ADDRESS not configured', async () => {
    await expect(handler.execute('0xWalletAddress')).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
