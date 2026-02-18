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

describe('GetVoucherByListingId', () => {
  let handler: GetVoucherByListingId;
  let blockchainService: any;
  let prisma: any;

  beforeEach(() => {
    blockchainService = { getMarketplaceListing: jest.fn() };
    prisma = {
      voucherCode: {
        findFirst: jest.fn(),
        count: jest.fn(),
      },
    };
    handler = new GetVoucherByListingId(
      blockchainService as unknown as BlockchainService,
      prisma as unknown as PrismaService,
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
});
