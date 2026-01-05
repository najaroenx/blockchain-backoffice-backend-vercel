import { Test, TestingModule } from '@nestjs/testing';
import { GetTreasuryBalance } from '../src/modules/transaction/handlers/getTreasuryBalance.handler';
import { BlockchainService } from '../src/providers/blockchain/blockchain.service';
import { GetPointById } from '../src/modules/point/handlers/getPointById.handler';
import { PrismaService } from '../prisma/prisma.service';
import {
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { INTERNAL_SERVER_ERROR } from '../src/errors/error.constants';

describe('GetTreasuryBalance', () => {
  let handler: GetTreasuryBalance;
  let prismaService: any;
  let blockchainService: jest.Mocked<BlockchainService>;
  let getPointByIdHandler: jest.Mocked<GetPointById>;

  const mockTreasury = {
    id: 'treasury-1',
    type: 'MERCHANT_RESERVE',
    walletAddress: '0x1234567890123456789012345678901234567890',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPoint = {
    id: 'point-1',
    merchantId: 'merchant-1',
    name: 'Test Point',
    symbol: 'TST',
    decimal: 18,
    initialSupply: 1000000,
    contractAddress: '0x1111111111111111111111111111111111111111',
    startDate: new Date(),
    endDate: new Date(Date.now() + 86400000),
    epochDuration: 259200,
    imageUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    // Required by GetPointById handler response type
    merchant: {
      id: 'merchant-1',
      name: 'Test Merchant',
      description: null,
      imageUrl: null,
      website: null,
    },
    statistics: {
      totalTransactions: 0,
      totalCustomers: 0,
      totalBalance: 0,
      initialSupply: 1000000,
      circulatingSupply: 0,
    },
  };

  beforeEach(async () => {
    const mockPrismaService = {
      treasury: {
        findUnique: jest.fn(),
      },
    } as any;

    const mockBlockchainService = {
      getBalance: jest.fn(),
    } as any;

    const mockGetPointByIdHandler = {
      execute: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetTreasuryBalance,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: BlockchainService,
          useValue: mockBlockchainService,
        },
        {
          provide: GetPointById,
          useValue: mockGetPointByIdHandler,
        },
      ],
    }).compile();

    handler = module.get<GetTreasuryBalance>(GetTreasuryBalance);
    prismaService = module.get(PrismaService);
    blockchainService = module.get(BlockchainService);
    getPointByIdHandler = module.get(GetPointById);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should successfully get treasury balance', async () => {
      const pointId = 'point-1';
      const treasuryType = 'MERCHANT_RESERVE';
      const expectedBalance = '1000.5';

      prismaService.treasury.findUnique.mockResolvedValue(mockTreasury);
      getPointByIdHandler.execute.mockResolvedValue({ point: mockPoint });
      blockchainService.getBalance.mockResolvedValue(expectedBalance);

      const result = await handler.execute(pointId, treasuryType);

      expect(result).toEqual({
        walletAddress: mockTreasury.walletAddress,
        pointId,
        balance: expectedBalance,
        treasuryType: mockTreasury.type,
      });

      expect(prismaService.treasury.findUnique).toHaveBeenCalledWith({
        where: { type: treasuryType },
      });
      expect(getPointByIdHandler.execute).toHaveBeenCalledWith(pointId);
      expect(blockchainService.getBalance).toHaveBeenCalledWith({
        walletAddress: mockTreasury.walletAddress,
        pointAddress: mockPoint.contractAddress,
      });
    });

    it('should throw NotFoundException when treasury not found', async () => {
      const pointId = 'point-1';
      const treasuryType = 'INVALID_TYPE';

      prismaService.treasury.findUnique.mockResolvedValue(null);

      await expect(handler.execute(pointId, treasuryType)).rejects.toThrow(
        new NotFoundException(`Treasury with type 'INVALID_TYPE' not found`),
      );

      expect(prismaService.treasury.findUnique).toHaveBeenCalledWith({
        where: { type: treasuryType },
      });
      expect(getPointByIdHandler.execute).not.toHaveBeenCalled();
      expect(blockchainService.getBalance).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when point not found', async () => {
      const pointId = 'invalid-point';
      const treasuryType = 'MERCHANT_RESERVE';

      prismaService.treasury.findUnique.mockResolvedValue(mockTreasury);
      getPointByIdHandler.execute.mockRejectedValue(
        new NotFoundException('Point not found'),
      );

      await expect(handler.execute(pointId, treasuryType)).rejects.toThrow(
        NotFoundException,
      );

      expect(prismaService.treasury.findUnique).toHaveBeenCalledWith({
        where: { type: treasuryType },
      });
      expect(getPointByIdHandler.execute).toHaveBeenCalledWith(pointId);
      expect(blockchainService.getBalance).not.toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException when blockchain service fails', async () => {
      const pointId = 'point-1';
      const treasuryType = 'MERCHANT_RESERVE';

      prismaService.treasury.findUnique.mockResolvedValue(mockTreasury);
      getPointByIdHandler.execute.mockResolvedValue({ point: mockPoint });
      blockchainService.getBalance.mockRejectedValue(
        new Error('Blockchain connection failed'),
      );

      await expect(handler.execute(pointId, treasuryType)).rejects.toThrow(
        new InternalServerErrorException(INTERNAL_SERVER_ERROR),
      );

      expect(prismaService.treasury.findUnique).toHaveBeenCalled();
      expect(getPointByIdHandler.execute).toHaveBeenCalled();
      expect(blockchainService.getBalance).toHaveBeenCalled();
    });

    it('should handle different treasury types', async () => {
      const pointId = 'point-1';
      const treasuryType = 'SYSTEM_RESERVE';
      const systemTreasury = {
        ...mockTreasury,
        type: 'SYSTEM_RESERVE',
        walletAddress: '0x9999999999999999999999999999999999999999',
      };

      prismaService.treasury.findUnique.mockResolvedValue(systemTreasury);
      getPointByIdHandler.execute.mockResolvedValue({ point: mockPoint });
      blockchainService.getBalance.mockResolvedValue('5000');

      const result = await handler.execute(pointId, treasuryType);

      expect(result.treasuryType).toBe('SYSTEM_RESERVE');
      expect(result.walletAddress).toBe(systemTreasury.walletAddress);
      expect(result.balance).toBe('5000');
    });

    it('should handle zero balance', async () => {
      const pointId = 'point-1';
      const treasuryType = 'MERCHANT_RESERVE';

      prismaService.treasury.findUnique.mockResolvedValue(mockTreasury);
      getPointByIdHandler.execute.mockResolvedValue({ point: mockPoint });
      blockchainService.getBalance.mockResolvedValue('0');

      const result = await handler.execute(pointId, treasuryType);

      expect(result.balance).toBe('0');
      expect(result.pointId).toBe(pointId);
    });

    it('should handle large balance values', async () => {
      const pointId = 'point-1';
      const treasuryType = 'MERCHANT_RESERVE';
      const largeBalance = '999999999999999999';

      prismaService.treasury.findUnique.mockResolvedValue(mockTreasury);
      getPointByIdHandler.execute.mockResolvedValue({ point: mockPoint });
      blockchainService.getBalance.mockResolvedValue(largeBalance);

      const result = await handler.execute(pointId, treasuryType);

      expect(result.balance).toBe(largeBalance);
    });

    it('should pass correct contract address to blockchain service', async () => {
      const pointId = 'point-1';
      const treasuryType = 'MERCHANT_RESERVE';
      const customContractAddress =
        '0x5555555555555555555555555555555555555555';
      const customPoint = {
        ...mockPoint,
        contractAddress: customContractAddress,
      };

      prismaService.treasury.findUnique.mockResolvedValue(mockTreasury);
      getPointByIdHandler.execute.mockResolvedValue({ point: customPoint });
      blockchainService.getBalance.mockResolvedValue('100');

      await handler.execute(pointId, treasuryType);

      expect(blockchainService.getBalance).toHaveBeenCalledWith({
        walletAddress: mockTreasury.walletAddress,
        pointAddress: customContractAddress,
      });
    });

    it('should throw InternalServerErrorException for generic errors', async () => {
      const pointId = 'point-1';
      const treasuryType = 'MERCHANT_RESERVE';

      prismaService.treasury.findUnique.mockResolvedValue(mockTreasury);
      getPointByIdHandler.execute.mockRejectedValue(
        new Error('Unexpected database error'),
      );

      await expect(handler.execute(pointId, treasuryType)).rejects.toThrow(
        new InternalServerErrorException(INTERNAL_SERVER_ERROR),
      );
    });

    it('should re-throw NotFoundException without wrapping', async () => {
      const pointId = 'point-1';
      const treasuryType = 'MERCHANT_RESERVE';
      const notFoundError = new NotFoundException('Custom not found message');

      prismaService.treasury.findUnique.mockResolvedValue(mockTreasury);
      getPointByIdHandler.execute.mockRejectedValue(notFoundError);

      await expect(handler.execute(pointId, treasuryType)).rejects.toThrow(
        notFoundError,
      );
    });

    it('should handle decimal balance values', async () => {
      const pointId = 'point-1';
      const treasuryType = 'MERCHANT_RESERVE';
      const decimalBalance = '1234.56789';

      prismaService.treasury.findUnique.mockResolvedValue(mockTreasury);
      getPointByIdHandler.execute.mockResolvedValue({ point: mockPoint });
      blockchainService.getBalance.mockResolvedValue(decimalBalance);

      const result = await handler.execute(pointId, treasuryType);

      expect(result.balance).toBe(decimalBalance);
    });

    it('should return all required fields in response', async () => {
      const pointId = 'point-1';
      const treasuryType = 'MERCHANT_RESERVE';

      prismaService.treasury.findUnique.mockResolvedValue(mockTreasury);
      getPointByIdHandler.execute.mockResolvedValue({ point: mockPoint });
      blockchainService.getBalance.mockResolvedValue('500');

      const result = await handler.execute(pointId, treasuryType);

      expect(result).toHaveProperty('walletAddress');
      expect(result).toHaveProperty('pointId');
      expect(result).toHaveProperty('balance');
      expect(result).toHaveProperty('treasuryType');
      expect(Object.keys(result)).toHaveLength(4);
    });
  });
});
