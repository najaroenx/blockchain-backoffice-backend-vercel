jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import {
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { GetVoucherByListingId } from 'src/modules/internal/voucher/handlers/getVoucherByListingId.handler';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';
import { PrismaService } from 'prisma/prisma.service';
import { MerchantRefEnrichmentService } from 'src/modules/shared/services/merchant-ref-enrichment.service';

describe('GetVoucherByListingId', () => {
  let handler: GetVoucherByListingId;
  let blockchainService: any;
  let prisma: any;
  let merchantRefEnrichment: any;

  beforeEach(() => {
    blockchainService = { getMarketplaceListing: jest.fn() };
    prisma = {
      voucherCode: {
        findFirst: jest.fn(),
        count: jest.fn(),
      },
      merchant: {
        findUnique: jest.fn(),
      },
    };
    merchantRefEnrichment = { enrich: jest.fn().mockResolvedValue(null) };
    handler = new GetVoucherByListingId(
      blockchainService as unknown as BlockchainService,
      prisma as unknown as PrismaService,
      merchantRefEnrichment as unknown as MerchantRefEnrichmentService,
    );
  });

  it('should throw NotFoundException when listing is not active', async () => {
    blockchainService.getMarketplaceListing.mockResolvedValue({
      isActive: false,
    });

    await expect(handler.execute('listing1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should throw NotFoundException when blockchain listing not found', async () => {
    blockchainService.getMarketplaceListing.mockRejectedValue(
      new Error('not found'),
    );

    await expect(handler.execute('listing1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should throw NotFoundException when no voucherCode in DB', async () => {
    blockchainService.getMarketplaceListing.mockResolvedValue({
      isActive: true,
      seller: '0x1',
      typeId: 1,
    });
    prisma.voucherCode.findFirst.mockResolvedValue(null);

    await expect(handler.execute('listing1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should return voucher data with available count', async () => {
    blockchainService.getMarketplaceListing.mockResolvedValue({
      isActive: true,
      seller: '0x1',
      typeId: 1,
    });

    const mockVoucherCode = {
      voucherId: 'v1',
      voucherGroupId: 'listing1',
      voucher: {
        id: 'v1',
        name: 'Test Voucher',
        merchant: {
          id: 'm1',
          name: 'Merchant',
          wallet: { walletAddress: '0xabc' },
        },
      },
      point: { id: 'p1', name: 'Point', symbol: 'PT' },
    };

    prisma.voucherCode.findFirst.mockResolvedValue(mockVoucherCode);
    prisma.voucherCode.count.mockResolvedValue(5);

    const result = await handler.execute('listing1');

    expect(result).toBeDefined();
    expect((result as any).voucher.totalRedeemed).toBe(5);
    expect((result as any).voucher.totalAvailable).toBe(5);
  });

  it('should throw InternalServerErrorException on unexpected error', async () => {
    blockchainService.getMarketplaceListing.mockResolvedValue({
      isActive: true,
      seller: '0x1',
      typeId: 1,
    });
    prisma.voucherCode.findFirst.mockRejectedValue(new Error('DB fail'));

    await expect(handler.execute('listing1')).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  it('should fallback to seller merchant when voucher merchantId is null', async () => {
    blockchainService.getMarketplaceListing.mockResolvedValue({
      isActive: true,
      seller: '0x1',
      typeId: 1,
    });

    prisma.voucherCode.findFirst.mockResolvedValue({
      voucherId: 'v1',
      voucherGroupId: 'listing1',
      voucher: {
        id: 'v1',
        name: 'Test Voucher',
        merchantId: null,
        sellerMerchantId: 'seller-1',
        merchantName: 'Seller One',
        merchantRef: null,
        tokenId: '1',
        description: 'Desc',
        status: 'active',
        valueType: 'cash',
        value: 100,
        thbPurchasePrice: null,
        currency: 'THB',
        startDate: null,
        endDate: null,
        totalIssued: 1,
        imageUrl: null,
        limitPerMember: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        merchant: null,
      },
      point: { id: 'p1', name: 'Point', symbol: 'PT' },
    });
    prisma.voucherCode.count.mockResolvedValue(1);
    prisma.merchant.findUnique.mockResolvedValue({
      id: 'seller-1',
      name: 'Seller One',
      wallet: { walletAddress: '0xabc' },
    });

    const result = await handler.execute('listing1');

    expect((result as any).voucher.merchantId).toBe('seller-1');
    expect((result as any).voucher.merchantName).toBe('Seller One');
    expect((result as any).voucher.merchant).toEqual(
      expect.objectContaining({ id: 'seller-1', name: 'Seller One' }),
    );
  });
});
