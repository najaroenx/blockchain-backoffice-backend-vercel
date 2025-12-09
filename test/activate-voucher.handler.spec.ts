import { Test, TestingModule } from '@nestjs/testing';
import { ActivateVoucher } from '../src/modules/voucher/handlers/activateVoucher.handler';
import { PrismaService } from '../prisma/prisma.service';
import { BlockchainService } from '../src/providers/blockchain/blockchain.service';
import { TokenService } from '../src/providers/token/token.service';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MockDataFactory } from './fixtures';
import {
  createMockPrismaClient,
  createMockBlockchainService,
  createMockTokenService,
  createMockConfigService,
} from './fixtures';

describe('ActivateVoucher', () => {
  let handler: ActivateVoucher;
  let prisma: any;
  let blockchainService: any;
  let tokenService: any;
  let configService: any;

  beforeEach(async () => {
    prisma = createMockPrismaClient();
    blockchainService = createMockBlockchainService();
    tokenService = createMockTokenService();
    configService = createMockConfigService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivateVoucher,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: BlockchainService,
          useValue: blockchainService,
        },
        {
          provide: TokenService,
          useValue: tokenService,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    handler = module.get<ActivateVoucher>(ActivateVoucher);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  describe('execute', () => {
    it('should successfully activate voucher with codes', async () => {
      const merchantId = 'merchant-123';
      const voucherId = 'voucher-123';
      const pointId = 'point-123';
      const pointCost = 100;
      const quantity = 50;

      const mockVoucher = MockDataFactory.createMockVoucher({
        id: voucherId,
        merchantId,
        tokenId: '12345',
        status: 'upcoming',
        totalIssued: 100,
      });

      const mockPoint = MockDataFactory.createMockPoint({
        id: pointId,
        merchantId,
        contractAddress: Buffer.from('POINT_ADDRESS', 'hex'),
      });

      const mockNFTBalance = MockDataFactory.createMockNFTBalance({
        balance: '100',
        tokenId: '12345',
      });

      const mockTxResponse = MockDataFactory.createMockBlockchainTx({
        hash: '0xLISTING_TX_HASH',
      });

      const mockMerchant = MockDataFactory.createMockMerchant({
        id: merchantId,
        wallet: {
          id: 'wallet-123',
          walletAddress: '0x1234567890123456789012345678901234567890',
          privateKey: 'encrypted-key',
          type: 'merchant',
          status: 'active',
        },
      });

      // Setup mocks
      prisma.voucher.findUnique.mockResolvedValue(mockVoucher);
      prisma.point.findUnique.mockResolvedValue(mockPoint);
      prisma.merchant.findUnique.mockResolvedValue(mockMerchant);

      blockchainService.getNFTBalance.mockResolvedValue(mockNFTBalance);
      blockchainService.addToWhitelist.mockResolvedValue({});
      blockchainService.createMarketplaceListing.mockResolvedValue(
        mockTxResponse,
      );

      prisma.voucherCode.createMany.mockResolvedValue({ count: quantity });
      prisma.voucher.update.mockResolvedValue({
        ...mockVoucher,
        status: 'active',
      });

      // Mock transaction
      prisma.$transaction.mockImplementation(async (callback) => {
        return callback(prisma);
      });

      // Execute
      const result = await handler.execute(
        voucherId,
        quantity,
        pointCost,
        pointId,
      );

      // Assertions
      expect(prisma.voucher.findUnique).toHaveBeenCalledWith({
        where: { id: voucherId },
      });
      expect(prisma.point.findUnique).toHaveBeenCalledWith({
        where: { id: pointId },
      });
      expect(blockchainService.getNFTBalance).toHaveBeenCalled();
      expect(blockchainService.createMarketplaceListing).toHaveBeenCalled();
      expect(prisma.voucherCode.createMany).toHaveBeenCalled();
      expect(prisma.voucher.update).toHaveBeenCalledWith({
        where: { id: voucherId },
        data: { status: 'active' },
      });

      expect(result).toMatchObject({
        message: expect.stringContaining('successfully activated'),
      });
    });

    it('should throw NotFoundException when voucher not found', async () => {
      const voucherId = 'invalid-voucher';

      prisma.voucher.findUnique.mockResolvedValue(null);

      await expect(
        handler.execute(voucherId, 50, 100, 'point-123'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when voucher does not belong to merchant', async () => {
      const voucherId = 'voucher-123';

      const mockVoucher = MockDataFactory.createMockVoucher({
        id: voucherId,
        merchantId: 'different-merchant',
      });

      prisma.voucher.findUnique.mockResolvedValue(mockVoucher);
      prisma.point.findUnique.mockResolvedValue(
        MockDataFactory.createMockPoint(),
      );

      await expect(
        handler.execute(voucherId, 50, 100, 'point-123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when voucher already active', async () => {
      const voucherId = 'voucher-123';

      const mockVoucher = MockDataFactory.createMockVoucher({
        id: voucherId,
        merchantId: 'merchant-123',
        status: 'active', // Already active
      });

      prisma.voucher.findUnique.mockResolvedValue(mockVoucher);
      prisma.point.findUnique.mockResolvedValue(
        MockDataFactory.createMockPoint(),
      );

      await expect(
        handler.execute(voucherId, 50, 100, 'point-123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when point not found', async () => {
      const voucherId = 'voucher-123';
      const pointId = 'invalid-point';

      const mockVoucher = MockDataFactory.createMockVoucher({
        id: voucherId,
        merchantId: 'merchant-123',
        status: 'upcoming',
      });

      prisma.voucher.findUnique.mockResolvedValue(mockVoucher);
      prisma.point.findUnique.mockResolvedValue(null);

      await expect(
        handler.execute(voucherId, 50, 100, pointId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when insufficient NFT balance', async () => {
      const voucherId = 'voucher-123';
      const pointId = 'point-123';
      const quantity = 50;

      const mockVoucher = MockDataFactory.createMockVoucher({
        id: voucherId,
        merchantId: 'merchant-123',
        tokenId: '12345',
        status: 'upcoming',
      });
      const mockPoint = MockDataFactory.createMockPoint({
        id: pointId,
        merchantId: 'merchant-123',
      });
      const mockNFTBalance = MockDataFactory.createMockNFTBalance({
        balance: '30', // Less than requested quantity
      });

      prisma.voucher.findUnique.mockResolvedValue(mockVoucher);
      prisma.point.findUnique.mockResolvedValue(mockPoint);
      blockchainService.getNFTBalance.mockResolvedValue(mockNFTBalance);

      await expect(
        handler.execute(voucherId, quantity, 100, pointId),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
