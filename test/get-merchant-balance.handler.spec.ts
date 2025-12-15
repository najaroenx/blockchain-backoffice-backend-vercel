import { Test, TestingModule } from '@nestjs/testing';
import { GetWalletBalance } from '../src/modules/transaction/handlers/getMerchantBalance.handler';
import { BlockchainService } from '../src/providers/blockchain/blockchain.service';
import { GetPointById } from '../src/modules/point/handlers/getPointById.handler';
import {
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

describe('GetWalletBalance', () => {
  let handler: GetWalletBalance;
  let blockchainService: jest.Mocked<BlockchainService>;
  let getPointByIdHandler: jest.Mocked<GetPointById>;

  const mockPointId = 'point-123';
  const mockWalletAddress = '0xMerchantWallet123';
  const mockContractAddress = '0xPointContract456';

  const mockPoint = {
    id: mockPointId,
    name: 'Loyalty Points',
    contractAddress: mockContractAddress,
    symbol: 'LP',
    decimals: 18,
  };

  beforeEach(async () => {
    const mockBlockchain = {
      getBalance: jest.fn(),
    };

    const mockGetPointById = {
      execute: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetWalletBalance,
        {
          provide: BlockchainService,
          useValue: mockBlockchain,
        },
        {
          provide: GetPointById,
          useValue: mockGetPointById,
        },
      ],
    }).compile();

    handler = module.get<GetWalletBalance>(GetWalletBalance);
    blockchainService = module.get(
      BlockchainService,
    ) as jest.Mocked<BlockchainService>;
    getPointByIdHandler = module.get(GetPointById) as jest.Mocked<GetPointById>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should return wallet balance successfully', async () => {
      // Arrange
      getPointByIdHandler.execute.mockResolvedValue({
        point: mockPoint as any,
      });
      blockchainService.getBalance.mockResolvedValue('1000.5');

      // Act
      const result = await handler.execute(mockPointId, mockWalletAddress);

      // Assert
      expect(getPointByIdHandler.execute).toHaveBeenCalledWith(mockPointId);
      expect(blockchainService.getBalance).toHaveBeenCalledWith({
        walletAddress: mockWalletAddress,
        pointAddress: mockContractAddress,
      });
      expect(result).toEqual({
        walletAddress: mockWalletAddress,
        pointId: mockPointId,
        balance: '1000.5',
      });
    });

    it('should handle zero balance', async () => {
      // Arrange
      getPointByIdHandler.execute.mockResolvedValue({
        point: mockPoint as any,
      });
      blockchainService.getBalance.mockResolvedValue('0');

      // Act
      const result = await handler.execute(mockPointId, mockWalletAddress);

      // Assert
      expect(result.balance).toBe('0');
    });

    it('should handle large balance', async () => {
      // Arrange
      getPointByIdHandler.execute.mockResolvedValue({
        point: mockPoint as any,
      });
      blockchainService.getBalance.mockResolvedValue('999999999.99');

      // Act
      const result = await handler.execute(mockPointId, mockWalletAddress);

      // Assert
      expect(result.balance).toBe('999999999.99');
    });

    it('should handle decimal balance', async () => {
      // Arrange
      getPointByIdHandler.execute.mockResolvedValue({
        point: mockPoint as any,
      });
      blockchainService.getBalance.mockResolvedValue('123.456789');

      // Act
      const result = await handler.execute(mockPointId, mockWalletAddress);

      // Assert
      expect(result.balance).toBe('123.456789');
    });

    it('should throw InternalServerErrorException if point not found', async () => {
      // Arrange
      getPointByIdHandler.execute.mockRejectedValue(
        new NotFoundException('Point not found'),
      );

      // Act & Assert
      await expect(
        handler.execute(mockPointId, mockWalletAddress),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw InternalServerErrorException on blockchain error', async () => {
      // Arrange
      getPointByIdHandler.execute.mockResolvedValue({
        point: mockPoint as any,
      });
      blockchainService.getBalance.mockRejectedValue(
        new Error('Blockchain RPC error'),
      );

      // Act & Assert
      await expect(
        handler.execute(mockPointId, mockWalletAddress),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should preserve HttpException from point handler', async () => {
      // Arrange
      const httpError = new NotFoundException('Point not found');
      (httpError as any).status = 404;
      getPointByIdHandler.execute.mockRejectedValue(httpError);

      // Act & Assert
      await expect(
        handler.execute(mockPointId, mockWalletAddress),
      ).rejects.toThrow(NotFoundException);
      await expect(
        handler.execute(mockPointId, mockWalletAddress),
      ).rejects.toThrow('Point not found');
    });

    it('should handle blockchain timeout error', async () => {
      // Arrange
      getPointByIdHandler.execute.mockResolvedValue({
        point: mockPoint as any,
      });
      blockchainService.getBalance.mockRejectedValue(
        new Error('Connection timeout'),
      );

      // Act & Assert
      await expect(
        handler.execute(mockPointId, mockWalletAddress),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should call getPointById without merchantId parameter', async () => {
      // Arrange
      getPointByIdHandler.execute.mockResolvedValue({
        point: mockPoint as any,
      });
      blockchainService.getBalance.mockResolvedValue('500');

      // Act
      await handler.execute(mockPointId, mockWalletAddress);

      // Assert
      expect(getPointByIdHandler.execute).toHaveBeenCalledWith(mockPointId);
      expect(getPointByIdHandler.execute).toHaveBeenCalledTimes(1);
    });

    it('should handle different wallet address formats', async () => {
      // Arrange
      const addresses = [
        '0x1234567890abcdef',
        '0xABCDEF1234567890',
        '0x0000000000000000000000000000000000000000',
      ];

      getPointByIdHandler.execute.mockResolvedValue({
        point: mockPoint as any,
      });
      blockchainService.getBalance.mockResolvedValue('100');

      // Act & Assert
      for (const address of addresses) {
        await handler.execute(mockPointId, address);
        expect(blockchainService.getBalance).toHaveBeenCalledWith({
          walletAddress: address,
          pointAddress: mockContractAddress,
        });
      }
    });

    it('should return correct response structure', async () => {
      // Arrange
      getPointByIdHandler.execute.mockResolvedValue({
        point: mockPoint as any,
      });
      blockchainService.getBalance.mockResolvedValue('750.25');

      // Act
      const result = await handler.execute(mockPointId, mockWalletAddress);

      // Assert
      expect(result).toHaveProperty('walletAddress');
      expect(result).toHaveProperty('pointId');
      expect(result).toHaveProperty('balance');
      expect(Object.keys(result)).toHaveLength(3);
    });

    it('should handle multiple consecutive calls', async () => {
      // Arrange
      getPointByIdHandler.execute.mockResolvedValue({
        point: mockPoint as any,
      });
      blockchainService.getBalance
        .mockResolvedValueOnce('100')
        .mockResolvedValueOnce('200')
        .mockResolvedValueOnce('300');

      // Act
      const result1 = await handler.execute(mockPointId, mockWalletAddress);
      const result2 = await handler.execute(mockPointId, mockWalletAddress);
      const result3 = await handler.execute(mockPointId, mockWalletAddress);

      // Assert
      expect(result1.balance).toBe('100');
      expect(result2.balance).toBe('200');
      expect(result3.balance).toBe('300');
      expect(blockchainService.getBalance).toHaveBeenCalledTimes(3);
    });

    it('should throw InternalServerErrorException on unexpected error', async () => {
      // Arrange
      getPointByIdHandler.execute.mockResolvedValue({
        point: mockPoint as any,
      });
      blockchainService.getBalance.mockRejectedValue(
        new Error('Unexpected error'),
      );

      // Act & Assert
      await expect(
        handler.execute(mockPointId, mockWalletAddress),
      ).rejects.toThrow(InternalServerErrorException);
      await expect(
        handler.execute(mockPointId, mockWalletAddress),
      ).rejects.toThrow('500000: Internal server error');
    });

    it('should handle point with different contract address', async () => {
      // Arrange
      const differentPoint = {
        ...mockPoint,
        contractAddress: '0xDifferentContract999',
      };
      getPointByIdHandler.execute.mockResolvedValue({
        point: differentPoint as any,
      });
      blockchainService.getBalance.mockResolvedValue('555');

      // Act
      await handler.execute(mockPointId, mockWalletAddress);

      // Assert
      expect(blockchainService.getBalance).toHaveBeenCalledWith({
        walletAddress: mockWalletAddress,
        pointAddress: '0xDifferentContract999',
      });
    });
  });
});
