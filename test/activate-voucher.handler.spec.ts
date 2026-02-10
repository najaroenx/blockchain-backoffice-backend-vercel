import { Test, TestingModule } from '@nestjs/testing';
import { ActivateVoucher } from '../src/modules/internal/voucher/handlers/activateVoucher.handler';
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

jest.mock('src/libs/derive-wallet', () => ({
  getSignerFromSeedPhrase: jest.fn().mockReturnValue({
    privateKey:
      '0x1234567890123456789012345678901234567890123456789012345678901234',
    address: '0x1234567890123456789012345678901234567890',
  }),
  deriveChildWallet: jest.fn(),
}));

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

      const mockVoucher = {
        ...MockDataFactory.createMockVoucher({
          id: voucherId,
          merchantId,
          tokenId: '12345',
          status: 'upcoming',
          totalIssued: 100,
        }),
        _count: { voucherCodes: 0 },
      };

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
          seedPhrase: 'encrypted-merchant-seed-phrase',
          derivationIndex: 0,
          type: 'merchant',
          status: 'active',
        },
      });

      // Setup mocks
      prisma.voucher.findUnique.mockResolvedValue(mockVoucher);
      prisma.point.findUnique.mockResolvedValue(mockPoint);
      prisma.merchant.findUnique.mockResolvedValue(mockMerchant);

      blockchainService.getUserCouponBalance.mockResolvedValue({
        address: '0x1234567890123456789012345678901234567890',
        typeId: '12345',
        balance: '100',
      });
      blockchainService.getNFTBalance.mockResolvedValue(mockNFTBalance);
      blockchainService.addToWhitelist.mockResolvedValue({});
      blockchainService.isWhitelisted.mockResolvedValue(true); // Already whitelisted
      blockchainService.addToMarketplaceWhitelist.mockResolvedValue(
        mockTxResponse,
      );
      blockchainService.listCoupon.mockResolvedValue({
        hash: '0xLISTING_TX_HASH',
        listingId: 'listing-123',
      });
      blockchainService.getMarketplaceListing.mockResolvedValue({
        listingId: 'listing-123',
        seller: '0x1234567890123456789012345678901234567890',
        typeId: '12345',
        amount: '100',
        pricePerUnit: '100',
        paymentToken: '0xPOINT_ADDRESS',
        isActive: true,
      });
      blockchainService.createMarketplaceListing.mockResolvedValue(
        mockTxResponse,
      );

      prisma.voucherCode.count.mockResolvedValue(0); // Starting code count
      prisma.voucherCode.createMany.mockResolvedValue({ count: quantity });
      prisma.voucherCode.updateMany.mockResolvedValue({ count: quantity });
      prisma.listingBatch.create.mockResolvedValue({
        id: 'listing-batch-1',
        name: 'merchant listing',
        status: 'ACTIVE',
        totalItems: quantity,
        soldItems: 0,
      });
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
        include: {
          _count: {
            select: { voucherCodes: true },
          },
        },
      });
      expect(prisma.point.findUnique).toHaveBeenCalledWith({
        where: { id: pointId },
        select: {
          id: true,
          symbol: true,
          merchantId: true,
          name: true,
          contractAddress: true,
        },
      });
      expect(blockchainService.getUserCouponBalance).toHaveBeenCalled();
      expect(blockchainService.listCoupon).toHaveBeenCalled();
      expect(prisma.voucherCode.createMany).toHaveBeenCalled();
      expect(prisma.voucher.update).toHaveBeenCalled(); // Handler updates with different data

      expect(result).toMatchObject({
        message: expect.stringContaining('Activated'),
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

      const mockVoucher = {
        ...MockDataFactory.createMockVoucher({
          id: voucherId,
          merchantId: 'different-merchant',
        }),
        _count: { voucherCodes: 0 },
      };

      prisma.voucher.findUnique.mockResolvedValue(mockVoucher);
      prisma.point.findUnique.mockResolvedValue(
        MockDataFactory.createMockPoint(),
      );

      await expect(
        handler.execute(voucherId, 50, 100, 'point-123'),
      ).rejects.toThrow(BadRequestException);
    });

    // Note: Handler allows re-activation of active vouchers (adds more codes)
    // There's no explicit status check to prevent this
    it('should allow adding codes to active voucher', async () => {
      const voucherId = 'voucher-123';
      const merchantId = 'merchant-123';
      const pointId = 'point-123';
      const quantity = 50;

      const mockVoucher = {
        ...MockDataFactory.createMockVoucher({
          id: voucherId,
          merchantId,
          status: 'active', // Already active
          tokenId: '12345',
          totalIssued: 100,
        }),
        _count: { voucherCodes: 0 },
      };

      const mockMerchant = MockDataFactory.createMockMerchant({
        id: merchantId,
        wallet: {
          walletAddress: '0x1234567890123456789012345678901234567890',
          privateKey: 'encrypted-key',
          seedPhrase: 'encrypted-merchant-seed-phrase',
          derivationIndex: 0,
        },
      });

      const mockPoint = MockDataFactory.createMockPoint({
        id: pointId,
        merchantId,
      });

      prisma.voucher.findUnique.mockResolvedValue(mockVoucher);
      prisma.point.findUnique.mockResolvedValue(mockPoint);
      prisma.merchant.findUnique.mockResolvedValue(mockMerchant);
      prisma.voucherCode.count.mockResolvedValue(0);
      prisma.voucherCode.createMany.mockResolvedValue({ count: quantity });
      prisma.voucherCode.updateMany.mockResolvedValue({ count: quantity });
      prisma.listingBatch.create.mockResolvedValue({
        id: 'listing-batch-1',
        name: 'merchant listing',
        status: 'ACTIVE',
        totalItems: quantity,
        soldItems: 0,
      });
      prisma.voucher.update.mockResolvedValue({
        ...mockVoucher,
        status: 'active',
      });

      // Mock transaction
      prisma.$transaction.mockImplementation(async (callback) => {
        return callback(prisma);
      });

      blockchainService.getUserCouponBalance.mockResolvedValue({
        address: '0x1234567890123456789012345678901234567890',
        typeId: '12345',
        balance: '100',
      });
      blockchainService.isWhitelisted.mockResolvedValue(true);
      blockchainService.listCoupon.mockResolvedValue({
        hash: '0xTX_HASH',
        listingId: 'listing-123',
      });
      blockchainService.getMarketplaceListing.mockResolvedValue({
        listingId: 'listing-123',
        isActive: true,
      });

      const result = await handler.execute(voucherId, quantity, 100, pointId);

      expect(result).toBeDefined();
    });

    it('should throw BadRequestException when point not found', async () => {
      const voucherId = 'voucher-123';
      const pointId = 'invalid-point';

      const mockVoucher = {
        ...MockDataFactory.createMockVoucher({
          id: voucherId,
          merchantId: 'merchant-123',
          status: 'upcoming',
        }),
        _count: { voucherCodes: 0 },
      };

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

      const mockVoucher = {
        ...MockDataFactory.createMockVoucher({
          id: voucherId,
          merchantId: 'merchant-123',
          tokenId: '12345',
          status: 'upcoming',
        }),
        _count: { voucherCodes: 0 },
      };
      const mockPoint = MockDataFactory.createMockPoint({
        id: pointId,
        merchantId: 'merchant-123',
      });
      const mockNFTBalance = MockDataFactory.createMockNFTBalance({
        balance: '30', // Less than requested quantity
      });

      prisma.voucher.findUnique.mockResolvedValue(mockVoucher);
      prisma.point.findUnique.mockResolvedValue(mockPoint);
      prisma.merchant.findUnique.mockResolvedValue(
        MockDataFactory.createMockMerchant({
          id: 'merchant-123',
          wallet: {
            walletAddress: '0x1234567890123456789012345678901234567890',
            privateKey: 'encrypted-key',
            seedPhrase: 'encrypted-merchant-seed-phrase',
            derivationIndex: 0,
          },
        }),
      );
      prisma.voucherCode.count.mockResolvedValue(0);
      prisma.voucherCode.createMany.mockResolvedValue({ count: quantity });
      prisma.voucherCode.updateMany.mockResolvedValue({ count: quantity });
      prisma.listingBatch.create.mockResolvedValue({
        id: 'listing-batch-1',
        name: 'merchant listing',
        status: 'ACTIVE',
        totalItems: quantity,
        soldItems: 0,
      });

      // Mock transaction to use same prisma mock
      prisma.$transaction.mockImplementation(async (callback) => {
        return callback(prisma);
      });

      blockchainService.getUserCouponBalance.mockResolvedValue({
        address: '0x1234567890123456789012345678901234567890',
        typeId: '12345',
        balance: '30',
      });
      blockchainService.getNFTBalance.mockResolvedValue(mockNFTBalance);

      await expect(
        handler.execute(voucherId, quantity, 100, pointId),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
