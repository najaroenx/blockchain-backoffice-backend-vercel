jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));
jest.mock('src/libs/derive-wallet', () => ({
  getSignerFromSeedPhrase: jest
    .fn()
    .mockReturnValue({ privateKey: '0xMerchantKey' }),
}));

import { BadRequestException } from '@nestjs/common';
import { DelistMarketplaceListingHandler } from '../src/modules/internal/voucher/handlers/delistMarketplaceListing.handler';
import { PrismaService } from 'prisma/prisma.service';
import { BlockchainService } from '../src/providers/blockchain/blockchain.service';
import { ConfigService } from '@nestjs/config';
import { TokenService } from '../src/providers/token/token.service';

describe('DelistMarketplaceListingHandler', () => {
  let handler: DelistMarketplaceListingHandler;
  let prisma: any;
  let blockchainService: any;
  let configService: any;
  let tokenService: any;

  const merchantId = 'merchant-1';
  const listingId = 'listing-999';

  const mockMerchant = {
    id: merchantId,
    wallet: {
      walletAddress: '0xMerchantAddr',
      seedPhrase: 'encrypted_seed',
      derivationIndex: 0,
    },
  };

  beforeEach(() => {
    prisma = {
      voucherCode: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
      merchant: { findUnique: jest.fn() },
    };
    blockchainService = { delistCoupon: jest.fn() };
    configService = { get: jest.fn().mockReturnValue('salt123') };
    tokenService = { decryptKey: jest.fn().mockReturnValue('decrypted_seed') };

    handler = new DelistMarketplaceListingHandler(
      prisma as unknown as PrismaService,
      blockchainService as unknown as BlockchainService,
      configService as unknown as ConfigService,
      tokenService as unknown as TokenService,
    );
  });

  describe('ownership validation', () => {
    it('should throw BadRequestException when another merchant owns the listing', async () => {
      prisma.voucherCode.findMany.mockResolvedValue([
        {
          currentOwnerId: 'other-merchant',
          currentOwnerType: 'MERCHANT',
          voucher: { merchantId: 'other-merchant' },
        },
      ]);

      await expect(handler.execute(listingId, merchantId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should allow delist when no voucher codes found (empty listing)', async () => {
      prisma.voucherCode.findMany.mockResolvedValue([]);
      prisma.merchant.findUnique.mockResolvedValue(mockMerchant);
      blockchainService.delistCoupon.mockResolvedValue({
        hash: '0xhash',
        blockNumber: 1,
      });

      const result = await handler.execute(listingId, merchantId);

      expect(result.success).toBe(true);
      expect(result.unlistedCount).toBe(0);
      expect(prisma.voucherCode.updateMany).not.toHaveBeenCalled();
    });

    it('should allow delist when merchant owns the codes directly', async () => {
      prisma.voucherCode.findMany.mockResolvedValue([
        {
          currentOwnerId: merchantId,
          currentOwnerType: 'MERCHANT',
          voucher: { merchantId },
        },
      ]);
      prisma.merchant.findUnique.mockResolvedValue(mockMerchant);
      blockchainService.delistCoupon.mockResolvedValue({
        hash: '0xhash',
        blockNumber: 1,
      });
      prisma.voucherCode.updateMany.mockResolvedValue({});

      const result = await handler.execute(listingId, merchantId);

      expect(result.success).toBe(true);
    });
  });

  describe('merchant wallet validation', () => {
    it('should throw BadRequestException when merchant has no wallet', async () => {
      prisma.voucherCode.findMany.mockResolvedValue([]);
      prisma.merchant.findUnique.mockResolvedValue({
        id: merchantId,
        wallet: null,
      });

      await expect(handler.execute(listingId, merchantId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when merchant wallet has no seedPhrase', async () => {
      prisma.voucherCode.findMany.mockResolvedValue([]);
      prisma.merchant.findUnique.mockResolvedValue({
        id: merchantId,
        wallet: { walletAddress: '0x1', seedPhrase: null, derivationIndex: 0 },
      });

      await expect(handler.execute(listingId, merchantId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when decryptKey returns null', async () => {
      prisma.voucherCode.findMany.mockResolvedValue([]);
      prisma.merchant.findUnique.mockResolvedValue(mockMerchant);
      tokenService.decryptKey.mockReturnValue(null);

      await expect(handler.execute(listingId, merchantId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('successful delist', () => {
    beforeEach(() => {
      prisma.voucherCode.findMany.mockResolvedValue([
        {
          currentOwnerId: merchantId,
          currentOwnerType: 'MERCHANT',
          voucher: { merchantId },
        },
        {
          currentOwnerId: merchantId,
          currentOwnerType: 'MERCHANT',
          voucher: { merchantId },
        },
      ]);
      prisma.merchant.findUnique.mockResolvedValue(mockMerchant);
      blockchainService.delistCoupon.mockResolvedValue({
        hash: '0xhash',
        blockNumber: 100,
      });
      prisma.voucherCode.updateMany.mockResolvedValue({});
    });

    it('should return success with correct unlistedCount', async () => {
      const result = await handler.execute(listingId, merchantId);

      expect(result).toEqual({
        success: true,
        message: `Listing ${listingId} successfully delisted`,
        listingId,
        unlistedCount: 2,
      });
    });

    it('should call delistCoupon with listingId and merchant privateKey', async () => {
      await handler.execute(listingId, merchantId);

      expect(blockchainService.delistCoupon).toHaveBeenCalledWith(
        listingId,
        '0xMerchantKey',
      );
    });

    it('should update voucherCode voucherGroupId to null', async () => {
      await handler.execute(listingId, merchantId);

      expect(prisma.voucherCode.updateMany).toHaveBeenCalledWith({
        where: { voucherGroupId: listingId },
        data: { voucherGroupId: null },
      });
    });

    it('should pass ownerType=CUSTOMER — fall back to voucher.merchantId', async () => {
      prisma.voucherCode.findMany.mockResolvedValue([
        {
          currentOwnerId: 'customer-x',
          currentOwnerType: 'CUSTOMER',
          voucher: { merchantId },
        },
      ]);

      const result = await handler.execute(listingId, merchantId);

      expect(result.success).toBe(true);
    });
  });

  describe('blockchain error', () => {
    it('should throw BadRequestException when delistCoupon fails', async () => {
      prisma.voucherCode.findMany.mockResolvedValue([]);
      prisma.merchant.findUnique.mockResolvedValue(mockMerchant);
      blockchainService.delistCoupon.mockRejectedValue(
        new Error('Revert: not owner'),
      );

      await expect(handler.execute(listingId, merchantId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
