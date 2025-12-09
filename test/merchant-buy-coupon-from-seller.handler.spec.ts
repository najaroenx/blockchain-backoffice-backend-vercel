import { Test, TestingModule } from '@nestjs/testing';
import { MerchantBuyCouponFromSeller } from '../src/modules/voucher/handlers/merchantBuyCouponFromSeller.handler';
import { PrismaService } from '../prisma/prisma.service';
import { BlockchainService } from '../src/providers/blockchain/blockchain.service';
import { TokenService } from '../src/providers/token/token.service';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  MockDataFactory,
  createMockPrismaClient,
  createMockBlockchainService,
  createMockTokenService,
  createMockConfigService,
} from './fixtures';

describe('MerchantBuyCouponFromSeller', () => {
  let handler: MerchantBuyCouponFromSeller;
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
        MerchantBuyCouponFromSeller,
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

    handler = module.get<MerchantBuyCouponFromSeller>(
      MerchantBuyCouponFromSeller,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  describe('execute', () => {
    it('should successfully purchase vouchers from marketplace and delete seller placeholder codes', async () => {
      const merchantId = 'merchant-123';
      const listingId = 'listing-123';
      const amount = 100;

      const mockMerchant = MockDataFactory.createMockMerchant({
        id: merchantId,
        walletId: 'wallet-123',
        wallet: {
          id: 'wallet-123',
          walletAddress: '0x1234567890123456789012345678901234567890',
          privateKey: 'encrypted-private-key',
          type: 'merchant',
          status: 'active',
        },
      });

      const mockListing = MockDataFactory.createMockMarketplaceListing({
        listingId,
        seller: '0xSELLER_ADDRESS',
        typeId: '12345',
        amount: '200',
        pricePerUnit: '100',
        paymentToken: '0xPOINT_TOKEN_ADDRESS',
        isActive: true,
      });

      const mockVoucher = MockDataFactory.createMockVoucher({
        id: 'voucher-123',
        tokenId: '12345',
        merchantId: 'seller-merchant-id',
        status: 'upcoming',
      });

      const mockPoint = MockDataFactory.createMockPoint({
        id: 'point-123',
        merchantId: 'seller-merchant-id',
        contractAddress: Buffer.from('POINT_TOKEN_ADDRESS', 'hex'),
      });

      const mockTxResponse = MockDataFactory.createMockBlockchainTx({
        hash: '0xTRANSACTION_HASH',
      });

      const mockNFTBalance = MockDataFactory.createMockNFTBalance({
        balance: '100',
      });

      // Setup mocks
      blockchainService.getMarketplaceListing.mockResolvedValue(mockListing);

      prisma.voucher.findFirst.mockResolvedValue(mockVoucher);
      prisma.point.findUnique.mockResolvedValue(mockPoint);
      prisma.merchant.findUnique.mockResolvedValue(mockMerchant);

      blockchainService.isWhitelisted.mockResolvedValue(true);
      blockchainService.getBalance.mockResolvedValue({ balance: '10000' });
      blockchainService.buyFromMarketplace.mockResolvedValue(mockTxResponse);
      blockchainService.getNFTBalance.mockResolvedValue(mockNFTBalance);

      prisma.voucherCode.createMany.mockResolvedValue({ count: 100 });
      prisma.voucherCode.deleteMany.mockResolvedValue({ count: 200 });
      prisma.transaction.create.mockResolvedValue({});

      // Mock transaction callback
      prisma.$transaction.mockImplementation(async (callback) => {
        return callback(prisma);
      });

      // Execute
      const result = await handler.execute(listingId, amount, merchantId);

      // Assertions
      expect(blockchainService.getMarketplaceListing).toHaveBeenCalledWith(
        listingId,
      );
      expect(blockchainService.isWhitelisted).toHaveBeenCalled();
      expect(blockchainService.buyFromMarketplace).toHaveBeenCalled();

      // Critical: Verify seller placeholder codes are deleted
      expect(prisma.voucherCode.deleteMany).toHaveBeenCalledWith({
        where: {
          voucherId: mockVoucher.id,
          voucherGroupId: listingId,
          pointId: null,
          currentOwnerId: null,
        },
      });

      // Verify voucher codes are created for merchant
      expect(prisma.voucherCode.createMany).toHaveBeenCalled();

      expect(result).toMatchObject({
        message: 'Successfully purchased vouchers from marketplace',
        voucherId: mockVoucher.id,
      });
    });

    it('should throw NotFoundException when marketplace listing not found', async () => {
      const merchantId = 'merchant-123';
      const listingId = 'invalid-listing';
      const amount = 100;

      blockchainService.getMarketplaceListing.mockResolvedValue(null);

      await expect(
        handler.execute(listingId, amount, merchantId),
      ).rejects.toThrow(NotFoundException);

      expect(blockchainService.getMarketplaceListing).toHaveBeenCalledWith(
        listingId,
      );
    });

    it('should throw BadRequestException when merchant not whitelisted', async () => {
      const merchantId = 'merchant-123';
      const listingId = 'listing-123';
      const amount = 100;

      const mockMerchant = MockDataFactory.createMockMerchant({
        id: merchantId,
      });
      const mockListing = MockDataFactory.createMockMarketplaceListing({
        listingId,
      });
      const mockVoucher = MockDataFactory.createMockVoucher({
        tokenId: '12345',
      });
      const mockPoint = MockDataFactory.createMockPoint();

      getMerchant.execute.mockResolvedValue({ merchant: mockMerchant });
      blockchainService.getMarketplaceListing.mockResolvedValue(mockListing);
      prisma.voucher.findFirst.mockResolvedValue(mockVoucher);
      prisma.point.findUnique.mockResolvedValue(mockPoint);
      blockchainService.isWhitelisted.mockResolvedValue(false);

      await expect(
        handler.execute(listingId, amount, merchantId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when insufficient balance', async () => {
      const merchantId = 'merchant-123';
      const listingId = 'listing-123';
      const amount = 100;

      const mockListing = MockDataFactory.createMockMarketplaceListing({
        listingId,
        pricePerUnit: '100',
      });
      const mockVoucher = MockDataFactory.createMockVoucher({
        tokenId: '12345',
      });
      const mockPoint = MockDataFactory.createMockPoint();

      blockchainService.getMarketplaceListing.mockResolvedValue(mockListing);
      prisma.voucher.findFirst.mockResolvedValue(mockVoucher);
      prisma.point.findUnique.mockResolvedValue(mockPoint);
      blockchainService.isWhitelisted.mockResolvedValue(true);
      blockchainService.getBalance.mockResolvedValue({ balance: '50' }); // Insufficient

      await expect(
        handler.execute(listingId, amount, merchantId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when requesting more vouchers than available', async () => {
      const merchantId = 'merchant-123';
      const listingId = 'listing-123';
      const amount = 300; // More than available

      const mockListing = MockDataFactory.createMockMarketplaceListing({
        listingId,
        amount: '200', // Only 200 available
      });
      const mockVoucher = MockDataFactory.createMockVoucher({
        tokenId: '12345',
      });
      const mockPoint = MockDataFactory.createMockPoint();

      blockchainService.getMarketplaceListing.mockResolvedValue(mockListing);
      prisma.voucher.findFirst.mockResolvedValue(mockVoucher);
      prisma.point.findUnique.mockResolvedValue(mockPoint);
      blockchainService.isWhitelisted.mockResolvedValue(true);
      blockchainService.getBalance.mockResolvedValue({ balance: '100000' });

      await expect(
        handler.execute(listingId, amount, merchantId),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
