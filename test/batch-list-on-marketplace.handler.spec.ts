import { Test, TestingModule } from '@nestjs/testing';
import { BatchListOnMarketplaceHandler } from '../src/modules/internal/voucher/handlers/batchListOnMarketplace.handler';
import { PrismaService } from '../prisma/prisma.service';
import { BlockchainService } from '../src/providers/blockchain/blockchain.service';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MockDataFactory } from './fixtures/mock-data.factory';
import { BatchListOnMarketplaceDto } from '../src/modules/internal/voucher/dtos/batch-list-marketplace.dto';
import { TokenService } from '../src/providers/token/token.service';

jest.mock('src/libs/derive-wallet', () => ({
  getSignerFromSeedPhrase: jest.fn().mockReturnValue({
    privateKey:
      '0x1234567890123456789012345678901234567890123456789012345678901234',
    address: '0x1234567890123456789012345678901234567890',
  }),
  deriveChildWallet: jest.fn(),
}));

describe('BatchListOnMarketplaceHandler', () => {
  let handler: BatchListOnMarketplaceHandler;
  let prismaService: any;
  let blockchainService: jest.Mocked<BlockchainService>;
  let configService: jest.Mocked<ConfigService>;

  const mockVoucher = MockDataFactory.createMockVoucher({
    id: 'voucher-1',
    name: 'Test Voucher 1',
    tokenId: '12345',
    totalIssued: 100,
    merchantId: null, // Seller vouchers have no merchantId
  });

  const mockVoucher2 = MockDataFactory.createMockVoucher({
    id: 'voucher-2',
    name: 'Test Voucher 2',
    tokenId: '12346',
    totalIssued: 200,
    merchantId: null,
  });

  const mockSellerWallet = MockDataFactory.createMockSellerWallet();
  const mockListingBatch = MockDataFactory.createMockListingBatch();
  const mockListingResult = MockDataFactory.createMockListingResult();

  beforeEach(async () => {
    const mockPrismaService = {
      merchant: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'merchant-123',
          name: 'Test Merchant',
          wallet: {
            walletAddress: '0xf5e40ec8bfa4818278c04489b34a486281658e5c',
            seedPhrase: 'encrypted-seed',
            derivationIndex: 0,
          },
        }),
      },
      wallet: {
        findFirst: jest.fn(),
      },
      voucher: {
        findMany: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      listingBatch: {
        create: jest.fn(),
      },
      voucherCode: {
        createMany: jest.fn(),
      },
    } as any;

    const mockBlockchainService = {
      isWhitelisted: jest.fn(),
      addToMarketplaceWhitelist: jest.fn(),
      mintCoupon: jest.fn(),
      listCoupon: jest.fn(),
    } as any;

    const mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'THB_ADDRESS') return '0xTHB_TOKEN_ADDRESS';
        return null;
      }),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BatchListOnMarketplaceHandler,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: BlockchainService, useValue: mockBlockchainService },
        { provide: ConfigService, useValue: mockConfigService },
        {
          provide: TokenService,
          useValue: {
            decryptKey: jest.fn().mockReturnValue('decrypted-seed'),
            encryptKey: jest.fn(),
          },
        },
      ],
    }).compile();

    handler = module.get<BatchListOnMarketplaceHandler>(
      BatchListOnMarketplaceHandler,
    );
    prismaService = module.get(PrismaService);
    blockchainService = module.get(BlockchainService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    const merchantId = 'merchant-123';
    const validDto: BatchListOnMarketplaceDto = {
      name: 'Test Batch',
      description: 'Test batch description',
      items: [
        { voucherId: 'voucher-1', amount: 10, pricePerUnitTHB: 100 },
        { voucherId: 'voucher-2', amount: 20, pricePerUnitTHB: 50 },
      ],
    };

    it('should successfully batch list multiple vouchers on marketplace', async () => {
      // Setup mocks
      prismaService.voucher.findMany.mockResolvedValue([
        mockVoucher,
        mockVoucher2,
      ]);
      prismaService.wallet.findFirst.mockResolvedValue(mockSellerWallet);
      prismaService.listingBatch.create.mockResolvedValue(mockListingBatch);
      prismaService.voucherCode.createMany.mockResolvedValue({ count: 30 });
      blockchainService.isWhitelisted.mockResolvedValue(true);
      blockchainService.mintCoupon.mockResolvedValue({
        hash: '0xmint',
        blockNumber: 100,
      });
      blockchainService.listCoupon.mockResolvedValue(mockListingResult);

      const result = await handler.execute(merchantId, validDto);

      expect(result.batch).toBeDefined();
      expect(result.batch.name).toBe('Test Batch Listing');
      expect(result.batch.status).toBe('ACTIVE');
      expect(result.items).toHaveLength(2);
      expect(result.nextSteps).toBeDefined();

      // Verify blockchain calls
      expect(blockchainService.mintCoupon).toHaveBeenCalledTimes(2);
      expect(blockchainService.listCoupon).toHaveBeenCalledTimes(2);
      expect(prismaService.voucherCode.createMany).toHaveBeenCalledTimes(2);
    });

    it('should throw NotFoundException when voucher not found', async () => {
      prismaService.wallet.findFirst
        .mockResolvedValueOnce({
          derivationIndex: 0,
          phoneNumber: '0812345678',
        }) // merchant wallet
        .mockResolvedValueOnce(mockSellerWallet); // seller wallet
      prismaService.voucher.findMany.mockResolvedValue([mockVoucher]); // Only return 1 of 2

      await expect(handler.execute(merchantId, validDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when voucher is already assigned to merchant', async () => {
      const voucherWithMerchant = {
        ...mockVoucher,
        merchantId: 'merchant-123',
      };
      prismaService.voucher.findMany.mockResolvedValue([
        voucherWithMerchant,
        mockVoucher2,
      ]);

      await expect(handler.execute(merchantId, validDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when voucher has no tokenId', async () => {
      const voucherNoToken = { ...mockVoucher, tokenId: null };
      prismaService.voucher.findMany.mockResolvedValue([
        voucherNoToken,
        mockVoucher2,
      ]);

      await expect(handler.execute(merchantId, validDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when amount exceeds totalIssued', async () => {
      const dto: BatchListOnMarketplaceDto = {
        ...validDto,
        items: [{ voucherId: 'voucher-1', amount: 999, pricePerUnitTHB: 100 }],
      };
      prismaService.voucher.findMany.mockResolvedValue([mockVoucher]);

      await expect(handler.execute(merchantId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when seller wallet not found', async () => {
      prismaService.voucher.findMany.mockResolvedValue([
        mockVoucher,
        mockVoucher2,
      ]);
      prismaService.wallet.findFirst.mockResolvedValue(null);

      await expect(handler.execute(merchantId, validDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when THB_ADDRESS not configured', async () => {
      prismaService.voucher.findMany.mockResolvedValue([
        mockVoucher,
        mockVoucher2,
      ]);
      prismaService.wallet.findFirst.mockResolvedValue(mockSellerWallet);
      (configService.get as jest.Mock).mockReturnValue(null);

      await expect(handler.execute(merchantId, validDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should add seller to whitelist when not already whitelisted', async () => {
      prismaService.voucher.findMany.mockResolvedValue([mockVoucher]);
      prismaService.wallet.findFirst.mockResolvedValue(mockSellerWallet);
      prismaService.listingBatch.create.mockResolvedValue(mockListingBatch);
      prismaService.voucherCode.createMany.mockResolvedValue({ count: 10 });
      blockchainService.isWhitelisted.mockResolvedValue(false); // Not whitelisted
      blockchainService.addToMarketplaceWhitelist.mockResolvedValue({
        hash: '0xwhitelist',
        blockNumber: 100,
      });
      blockchainService.mintCoupon.mockResolvedValue({
        hash: '0xmint',
        blockNumber: 100,
      });
      blockchainService.listCoupon.mockResolvedValue(mockListingResult);

      const singleItemDto = {
        ...validDto,
        items: [{ voucherId: 'voucher-1', amount: 10, pricePerUnitTHB: 100 }],
      };

      await handler.execute(merchantId, singleItemDto);

      expect(blockchainService.addToMarketplaceWhitelist).toHaveBeenCalled();
    });

    it('should calculate totalItems and totalValue correctly', async () => {
      prismaService.voucher.findMany.mockResolvedValue([
        mockVoucher,
        mockVoucher2,
      ]);
      prismaService.wallet.findFirst.mockResolvedValue(mockSellerWallet);
      prismaService.listingBatch.create.mockResolvedValue(mockListingBatch);
      prismaService.voucherCode.createMany.mockResolvedValue({ count: 30 });
      blockchainService.isWhitelisted.mockResolvedValue(true);
      blockchainService.mintCoupon.mockResolvedValue({
        hash: '0xmint',
        blockNumber: 100,
      });
      blockchainService.listCoupon.mockResolvedValue(mockListingResult);

      await handler.execute(merchantId, validDto);

      // totalItems = 10 + 20 = 30
      // totalValue = (10 * 100) + (20 * 50) = 1000 + 1000 = 2000
      expect(prismaService.listingBatch.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          totalItems: 30,
          totalValue: 2000,
          currency: 'THB',
          status: 'ACTIVE',
          soldItems: 0,
        }),
      });
    });
  });
});
