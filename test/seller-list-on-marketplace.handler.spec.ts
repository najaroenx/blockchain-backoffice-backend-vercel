import { Test, TestingModule } from '@nestjs/testing';
import { SellerListOnMarketplace } from '../src/modules/internal/voucher/handlers/sellerListOnMarketplace.handler';
import { PrismaService } from '../prisma/prisma.service';
import { BlockchainService } from '../src/providers/blockchain/blockchain.service';
import { ConfigService } from '@nestjs/config';
import { TokenService } from '../src/providers/token/token.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MockDataFactory } from './fixtures/mock-data.factory';

jest.mock('src/libs/derive-wallet', () => ({
  getSignerFromSeedPhrase: jest.fn().mockReturnValue({
    privateKey: '0x1234567890123456789012345678901234567890123456789012345678901234',
    address: '0x1234567890123456789012345678901234567890',
  }),
  deriveChildWallet: jest.fn(),
}));

describe('SellerListOnMarketplace', () => {
  let handler: SellerListOnMarketplace;
  let prismaService: any;
  let blockchainService: jest.Mocked<BlockchainService>;
  let configService: jest.Mocked<ConfigService>;

  const mockVoucher = MockDataFactory.createMockVoucher({
    id: 'voucher-1',
    name: 'Test Voucher',
    tokenId: '12345',
    totalIssued: 100,
    status: 'active',
    merchantId: null, // Seller voucher has no merchantId
  });

  const mockSellerWallet = MockDataFactory.createMockSellerWallet();
  const mockListingBatch = MockDataFactory.createMockListingBatch();
  const mockListingResult = MockDataFactory.createMockListingResult();
  const mockMintResult = { hash: '0xmint123', blockNumber: 100 };

  beforeEach(async () => {
    const mockPrismaService = {
      voucher: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      wallet: {
        findFirst: jest.fn(),
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
        SellerListOnMarketplace,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: BlockchainService, useValue: mockBlockchainService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: TokenService, useValue: { decryptKey: jest.fn().mockReturnValue('decrypted-seed-phrase'), encryptKey: jest.fn() } },
      ],
    }).compile();

    handler = module.get<SellerListOnMarketplace>(SellerListOnMarketplace);
    prismaService = module.get(PrismaService);
    blockchainService = module.get(BlockchainService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    const voucherId = 'voucher-1';
    const amount = 10;
    const pricePerUnitTHB = 100;
    const sellerWalletAddress = '0xf5e40ec8bfa4818278c04489b34a486281658e5c';
    const name = 'Test Listing';
    const description = 'Test listing description';

    it('should successfully list voucher on marketplace with ListingBatch creation', async () => {
      prismaService.voucher.findUnique.mockResolvedValue(mockVoucher);
      prismaService.wallet.findFirst.mockResolvedValue(mockSellerWallet);
      prismaService.listingBatch.create.mockResolvedValue(mockListingBatch);
      prismaService.voucherCode.createMany.mockResolvedValue({ count: amount });
      blockchainService.isWhitelisted.mockResolvedValue(true);
      blockchainService.mintCoupon.mockResolvedValue(mockMintResult);
      blockchainService.listCoupon.mockResolvedValue(mockListingResult);

      const result = await handler.execute(
        voucherId,
        amount,
        pricePerUnitTHB,
        sellerWalletAddress,
        name,
        description,
      );

      expect(result.batch).toBeDefined();
      expect(result.batch.id).toBe(mockListingBatch.id);
      expect(result.listing).toBeDefined();
      expect(result.listing.voucherId).toBe(voucherId);
      expect(result.listing.amount).toBe(amount);
      expect(result.listing.pricePerUnitTHB).toBe(pricePerUnitTHB);
      expect(result.blockchain).toBeDefined();
      expect(result.nextSteps).toBeDefined();
    });

    it('should throw NotFoundException when voucher not found', async () => {
      prismaService.voucher.findUnique.mockResolvedValue(null);

      await expect(
        handler.execute(
          voucherId,
          amount,
          pricePerUnitTHB,
          sellerWalletAddress,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when voucher is already assigned to merchant', async () => {
      const voucherWithMerchant = {
        ...mockVoucher,
        merchantId: 'merchant-123',
      };
      prismaService.voucher.findUnique.mockResolvedValue(voucherWithMerchant);

      await expect(
        handler.execute(
          voucherId,
          amount,
          pricePerUnitTHB,
          sellerWalletAddress,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when voucher has no tokenId', async () => {
      const voucherNoToken = { ...mockVoucher, tokenId: null };
      prismaService.voucher.findUnique.mockResolvedValue(voucherNoToken);

      await expect(
        handler.execute(
          voucherId,
          amount,
          pricePerUnitTHB,
          sellerWalletAddress,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when amount exceeds totalIssued', async () => {
      prismaService.voucher.findUnique.mockResolvedValue(mockVoucher);

      await expect(
        handler.execute(voucherId, 999, pricePerUnitTHB, sellerWalletAddress),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when seller wallet not found', async () => {
      prismaService.voucher.findUnique.mockResolvedValue(mockVoucher);
      prismaService.wallet.findFirst.mockResolvedValue(null);

      await expect(
        handler.execute(
          voucherId,
          amount,
          pricePerUnitTHB,
          sellerWalletAddress,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when seller wallet has no seed phrase', async () => {
      prismaService.voucher.findUnique.mockResolvedValue(mockVoucher);
      prismaService.wallet.findFirst.mockResolvedValue({
        ...mockSellerWallet,
        seedPhrase: null,
      });

      await expect(
        handler.execute(
          voucherId,
          amount,
          pricePerUnitTHB,
          sellerWalletAddress,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when THB_ADDRESS not configured', async () => {
      prismaService.voucher.findUnique.mockResolvedValue(mockVoucher);
      prismaService.wallet.findFirst.mockResolvedValue(mockSellerWallet);
      (configService.get as jest.Mock).mockReturnValue(null);

      await expect(
        handler.execute(
          voucherId,
          amount,
          pricePerUnitTHB,
          sellerWalletAddress,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should add seller to whitelist when not already whitelisted', async () => {
      prismaService.voucher.findUnique.mockResolvedValue(mockVoucher);
      prismaService.wallet.findFirst.mockResolvedValue(mockSellerWallet);
      prismaService.listingBatch.create.mockResolvedValue(mockListingBatch);
      prismaService.voucherCode.createMany.mockResolvedValue({ count: amount });
      blockchainService.isWhitelisted.mockResolvedValue(false);
      blockchainService.addToMarketplaceWhitelist.mockResolvedValue({
        hash: '0xwhitelist',
        blockNumber: 100,
      });
      blockchainService.mintCoupon.mockResolvedValue(mockMintResult);
      blockchainService.listCoupon.mockResolvedValue(mockListingResult);

      await handler.execute(
        voucherId,
        amount,
        pricePerUnitTHB,
        sellerWalletAddress,
      );

      expect(blockchainService.addToMarketplaceWhitelist).toHaveBeenCalledWith(
        sellerWalletAddress,
      );
    });

    it('should not add to whitelist when seller is already whitelisted', async () => {
      prismaService.voucher.findUnique.mockResolvedValue(mockVoucher);
      prismaService.wallet.findFirst.mockResolvedValue(mockSellerWallet);
      prismaService.listingBatch.create.mockResolvedValue(mockListingBatch);
      prismaService.voucherCode.createMany.mockResolvedValue({ count: amount });
      blockchainService.isWhitelisted.mockResolvedValue(true);
      blockchainService.mintCoupon.mockResolvedValue(mockMintResult);
      blockchainService.listCoupon.mockResolvedValue(mockListingResult);

      await handler.execute(
        voucherId,
        amount,
        pricePerUnitTHB,
        sellerWalletAddress,
      );

      expect(
        blockchainService.addToMarketplaceWhitelist,
      ).not.toHaveBeenCalled();
    });

    it('should create ListingBatch with correct totalValue', async () => {
      prismaService.voucher.findUnique.mockResolvedValue(mockVoucher);
      prismaService.wallet.findFirst.mockResolvedValue(mockSellerWallet);
      prismaService.listingBatch.create.mockResolvedValue(mockListingBatch);
      prismaService.voucherCode.createMany.mockResolvedValue({ count: amount });
      blockchainService.isWhitelisted.mockResolvedValue(true);
      blockchainService.mintCoupon.mockResolvedValue(mockMintResult);
      blockchainService.listCoupon.mockResolvedValue(mockListingResult);

      await handler.execute(
        voucherId,
        amount,
        pricePerUnitTHB,
        sellerWalletAddress,
        name,
        description,
      );

      expect(prismaService.listingBatch.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          sellerWalletAddress: sellerWalletAddress.toLowerCase(),
          name: name,
          description: description,
          totalItems: amount,
          totalValue: amount * pricePerUnitTHB, // 10 * 100 = 1000
          soldItems: 0,
          currency: 'THB',
          status: 'ACTIVE',
        }),
      });
    });

    it('should create voucher codes with listingBatchId', async () => {
      prismaService.voucher.findUnique.mockResolvedValue(mockVoucher);
      prismaService.wallet.findFirst.mockResolvedValue(mockSellerWallet);
      prismaService.listingBatch.create.mockResolvedValue(mockListingBatch);
      prismaService.voucherCode.createMany.mockResolvedValue({ count: amount });
      blockchainService.isWhitelisted.mockResolvedValue(true);
      blockchainService.mintCoupon.mockResolvedValue(mockMintResult);
      blockchainService.listCoupon.mockResolvedValue(mockListingResult);

      await handler.execute(
        voucherId,
        amount,
        pricePerUnitTHB,
        sellerWalletAddress,
      );

      expect(prismaService.voucherCode.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            voucherId: mockVoucher.id,
            listingBatchId: mockListingBatch.id,
            voucherGroupId: mockListingResult.listingId,
            currency: 'THB',
            pointsCost: pricePerUnitTHB,
          }),
        ]),
      });
    });

    it('should return correct listing details with THB payment token', async () => {
      prismaService.voucher.findUnique.mockResolvedValue(mockVoucher);
      prismaService.wallet.findFirst.mockResolvedValue(mockSellerWallet);
      prismaService.listingBatch.create.mockResolvedValue(mockListingBatch);
      prismaService.voucherCode.createMany.mockResolvedValue({ count: amount });
      blockchainService.isWhitelisted.mockResolvedValue(true);
      blockchainService.mintCoupon.mockResolvedValue(mockMintResult);
      blockchainService.listCoupon.mockResolvedValue(mockListingResult);

      const result = await handler.execute(
        voucherId,
        amount,
        pricePerUnitTHB,
        sellerWalletAddress,
      );

      expect(result.listing.totalPriceTHB).toBe(amount * pricePerUnitTHB);
      expect(result.listing.paymentToken).toBe('0xTHB_TOKEN_ADDRESS');
      expect(result.listing.seller).toBe(sellerWalletAddress);
    });
  });
});
