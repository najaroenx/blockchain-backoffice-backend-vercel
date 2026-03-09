jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));
jest.mock('src/libs/convertBufferToAddress', () => ({
  convertBufferToAddress: jest.fn(
    (buf) => '0x' + Buffer.from(buf || []).toString('hex'),
  ),
}));
jest.mock('src/libs/derive-wallet', () => ({
  getSignerFromSeedPhrase: jest.fn(() => ({ privateKey: '0xprivatekey' })),
}));

import { NotFoundException, BadRequestException } from '@nestjs/common';
import { BuyCouponFromMarketplace } from 'src/modules/internal/voucher/handlers/buyCouponFromMarketplace.handler';

describe('BuyCouponFromMarketplace', () => {
  let handler: BuyCouponFromMarketplace;
  let mockPrisma: any;
  let mockBlockchain: any;
  let mockToken: any;
  let mockConfig: any;

  beforeEach(() => {
    mockPrisma = {
      customer: { findFirst: jest.fn() },
      voucherCode: {
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      customerPoint: {
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      wallet: { findUnique: jest.fn(), findFirst: jest.fn() },
      transaction: {
        create: jest
          .fn()
          .mockResolvedValue({ id: 'tx1', createdAt: new Date() }),
      },
      listingBatch: { update: jest.fn(), findUnique: jest.fn() },
      $transaction: jest.fn(),
    };
    mockBlockchain = {
      isWhitelisted: jest.fn().mockResolvedValue(true),
      addToMarketplaceWhitelist: jest.fn(),
      getMarketplaceListing: jest.fn(),
      buyCoupon: jest.fn(),
    };
    mockToken = {
      decryptKey: jest.fn().mockReturnValue('decrypted-seed'),
    };
    mockConfig = {
      get: jest.fn().mockReturnValue('test-salt'),
    };
    handler = new BuyCouponFromMarketplace(
      mockPrisma as any,
      mockBlockchain as any,
      mockToken as any,
      mockConfig as any,
    );
  });

  it('should throw NotFoundException when customer not found', async () => {
    mockPrisma.customer.findFirst.mockResolvedValue(null);
    await expect(handler.execute('g1', 'p1', '0812345678')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should throw NotFoundException when no available voucher code', async () => {
    mockPrisma.customer.findFirst.mockResolvedValue({
      id: 'c1',
      walletId: 'w1',
    });
    mockPrisma.voucherCode.findFirst.mockResolvedValue(null);
    await expect(handler.execute('g1', 'p1', '0812345678')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should throw BadRequestException when no pointId configured', async () => {
    mockPrisma.customer.findFirst.mockResolvedValue({
      id: 'c1',
      walletId: 'w1',
    });
    mockPrisma.voucherCode.findFirst.mockResolvedValue({
      id: 'vc1',
      pointId: null,
      isUsed: false,
      voucherGroupId: 'g1',
      voucher: { id: 'v1', endDate: null, startDate: null, merchantId: 'm1' },
    });
    await expect(handler.execute('g1', 'p1', '0812345678')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should throw BadRequestException when code already used', async () => {
    mockPrisma.customer.findFirst.mockResolvedValue({
      id: 'c1',
      walletId: 'w1',
    });
    mockPrisma.voucherCode.findFirst.mockResolvedValue({
      id: 'vc1',
      pointId: 'p1',
      isUsed: true,
      voucherGroupId: 'g1',
      voucher: { id: 'v1', endDate: null, startDate: null, merchantId: 'm1' },
    });
    await expect(handler.execute('g1', 'p1', '0812345678')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should throw BadRequestException when voucher expired', async () => {
    mockPrisma.customer.findFirst.mockResolvedValue({
      id: 'c1',
      walletId: 'w1',
    });
    mockPrisma.voucherCode.findFirst.mockResolvedValue({
      id: 'vc1',
      pointId: 'p1',
      isUsed: false,
      voucherGroupId: 'g1',
      voucher: {
        id: 'v1',
        endDate: new Date(Date.now() - 86400000),
        startDate: null,
        merchantId: 'm1',
      },
    });
    await expect(handler.execute('g1', 'p1', '0812345678')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should throw BadRequestException when insufficient point balance', async () => {
    mockPrisma.customer.findFirst.mockResolvedValue({
      id: 'c1',
      walletId: 'w1',
    });
    mockPrisma.voucherCode.findFirst.mockResolvedValue({
      id: 'vc1',
      pointId: 'p1',
      isUsed: false,
      voucherGroupId: 'g1',
      pointsCost: 100,
      currency: 'PTS',
      point: { id: 'p1', contractAddress: Buffer.from('ab', 'hex') },
      voucher: { id: 'v1', endDate: null, startDate: null, merchantId: 'm1' },
    });
    mockPrisma.customerPoint.findFirst.mockResolvedValue({
      id: 'cp1',
      balances: 50,
    });
    await expect(handler.execute('g1', 'p1', '0812345678')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should throw BadRequestException when no customer points', async () => {
    mockPrisma.customer.findFirst.mockResolvedValue({
      id: 'c1',
      walletId: 'w1',
    });
    mockPrisma.voucherCode.findFirst.mockResolvedValue({
      id: 'vc1',
      pointId: 'p1',
      isUsed: false,
      voucherGroupId: 'g1',
      pointsCost: 100,
      currency: 'PTS',
      voucher: { id: 'v1', endDate: null, startDate: null, merchantId: 'm1' },
    });
    mockPrisma.customerPoint.findFirst.mockResolvedValue(null);
    await expect(handler.execute('g1', 'p1', '0812345678')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should throw BadRequestException when wallet not configured', async () => {
    mockPrisma.customer.findFirst.mockResolvedValue({
      id: 'c1',
      walletId: 'w1',
    });
    mockPrisma.voucherCode.findFirst.mockResolvedValue({
      id: 'vc1',
      pointId: 'p1',
      isUsed: false,
      voucherGroupId: 'g1',
      pointsCost: 50,
      currency: 'PTS',
      voucher: { id: 'v1', endDate: null, startDate: null, merchantId: 'm1' },
    });
    mockPrisma.customerPoint.findFirst.mockResolvedValue({
      id: 'cp1',
      balances: 200,
    });
    mockPrisma.wallet.findUnique.mockResolvedValue(null);
    await expect(handler.execute('g1', 'p1', '0812345678')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should whitelist customer if not already whitelisted', async () => {
    mockPrisma.customer.findFirst.mockResolvedValue({
      id: 'c1',
      walletId: 'w1',
    });
    mockPrisma.voucherCode.findFirst.mockResolvedValue({
      id: 'vc1',
      pointId: 'p1',
      isUsed: false,
      voucherGroupId: '123',
      pointsCost: 50,
      currency: 'PTS',
      currentOwnerType: null,
      currentOwnerId: null,
      listingBatchId: null,
      point: {
        id: 'p1',
        name: 'Point',
        symbol: 'PTS',
        contractAddress: Buffer.from('ab', 'hex'),
        imageUrl: null,
      },
      voucher: {
        id: 'v1',
        endDate: null,
        startDate: null,
        merchantId: 'm1',
        merchantRef: null,
        name: 'V1',
        description: '',
        valueType: 'fixed',
        value: 100,
        merchant: {
          id: 'm1',
          name: 'Merchant',
          description: '',
          imageUrl: null,
        },
      },
    });
    mockPrisma.customerPoint.findFirst.mockResolvedValue({
      id: 'cp1',
      balances: 200,
    });
    mockPrisma.wallet.findUnique.mockResolvedValue({
      walletAddress: '0xcustomer',
      seedPhrase: 'enc',
      derivationIndex: 0,
    });
    mockBlockchain.isWhitelisted.mockResolvedValue(false);
    mockBlockchain.getMarketplaceListing.mockResolvedValue({
      isActive: true,
      paymentToken: '0xab',
    });
    mockBlockchain.buyCoupon.mockResolvedValue({
      hash: '0xhash',
      blockNumber: 10,
    });
    mockPrisma.wallet.findFirst.mockResolvedValue({
      walletAddress: '0xmerchant',
    });
    mockPrisma.$transaction.mockImplementation(async (ops) => Promise.all(ops));

    const result = await handler.execute('g1', 'p1', '0812345678');
    expect(mockBlockchain.addToMarketplaceWhitelist).toHaveBeenCalledWith(
      '0xcustomer',
    );
    expect(result.success).toBe(true);
  });

  it('should throw BadRequestException on blockchain buy failure', async () => {
    mockPrisma.customer.findFirst.mockResolvedValue({
      id: 'c1',
      walletId: 'w1',
    });
    mockPrisma.voucherCode.findFirst.mockResolvedValue({
      id: 'vc1',
      pointId: 'p1',
      isUsed: false,
      voucherGroupId: '123',
      pointsCost: 50,
      currency: 'PTS',
      currentOwnerType: null,
      currentOwnerId: null,
      point: { id: 'p1', contractAddress: Buffer.from('ab', 'hex') },
      voucher: { id: 'v1', endDate: null, startDate: null, merchantId: 'm1' },
    });
    mockPrisma.customerPoint.findFirst.mockResolvedValue({
      id: 'cp1',
      balances: 200,
    });
    mockPrisma.wallet.findUnique.mockResolvedValue({
      walletAddress: '0xcustomer',
      seedPhrase: 'enc',
      derivationIndex: 0,
    });
    mockBlockchain.getMarketplaceListing.mockResolvedValue({ isActive: false });

    await expect(handler.execute('g1', 'p1', '0812345678')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should update listing batch soldItems on purchase', async () => {
    mockPrisma.customer.findFirst.mockResolvedValue({
      id: 'c1',
      walletId: 'w1',
    });
    mockPrisma.voucherCode.findFirst.mockResolvedValue({
      id: 'vc1',
      pointId: 'p1',
      isUsed: false,
      voucherGroupId: '123',
      pointsCost: 50,
      currency: 'PTS',
      listingBatchId: 'lb1',
      currentOwnerType: null,
      currentOwnerId: null,
      point: {
        id: 'p1',
        name: 'P',
        symbol: 'PTS',
        contractAddress: Buffer.from('ab', 'hex'),
        imageUrl: null,
      },
      voucher: {
        id: 'v1',
        endDate: null,
        startDate: null,
        merchantId: 'm1',
        merchantRef: null,
        name: 'V',
        description: '',
        valueType: 'fixed',
        value: 100,
        merchant: { id: 'm1', name: 'M', description: '', imageUrl: null },
      },
    });
    mockPrisma.customerPoint.findFirst.mockResolvedValue({
      id: 'cp1',
      balances: 200,
    });
    mockPrisma.wallet.findUnique.mockResolvedValue({
      walletAddress: '0xcustomer',
      seedPhrase: 'enc',
      derivationIndex: 0,
    });
    mockBlockchain.getMarketplaceListing.mockResolvedValue({
      isActive: true,
      paymentToken: '0xab',
    });
    mockBlockchain.buyCoupon.mockResolvedValue({
      hash: '0xhash',
      blockNumber: 10,
    });
    mockPrisma.wallet.findFirst.mockResolvedValue({
      walletAddress: '0xmerchant',
    });
    mockPrisma.$transaction.mockImplementation(async (ops) => Promise.all(ops));
    mockPrisma.listingBatch.update.mockResolvedValue({});
    mockPrisma.listingBatch.findUnique.mockResolvedValue({
      totalItems: 10,
      soldItems: 10,
    });

    const result = await handler.execute('g1', 'p1', '0812345678');
    expect(result.success).toBe(true);
    expect(mockPrisma.listingBatch.update).toHaveBeenCalled();
  });

  it('should use sellerMerchantId for marketplace transactions when merchantId is null', async () => {
    mockPrisma.customer.findFirst.mockResolvedValue({
      id: 'c1',
      walletId: 'w1',
    });
    mockPrisma.voucherCode.findFirst.mockResolvedValue({
      id: 'vc1',
      code: 'SELLER-CODE',
      pointId: 'p1',
      isUsed: false,
      voucherGroupId: '123',
      pointsCost: 50,
      currency: 'PTS',
      listingBatchId: null,
      currentOwnerType: null,
      currentOwnerId: null,
      point: {
        id: 'p1',
        name: 'P',
        symbol: 'PTS',
        contractAddress: Buffer.from('ab', 'hex'),
        imageUrl: null,
      },
      voucher: {
        id: 'v1',
        endDate: null,
        startDate: null,
        merchantId: null,
        sellerMerchantId: 'seller-merchant-1',
        merchantRef: null,
        name: 'Seller Voucher',
        description: '',
        valueType: 'fixed',
        value: 100,
        merchantName: 'Seller Merchant',
        merchant: null,
      },
    });
    mockPrisma.customerPoint.findFirst.mockResolvedValue({
      id: 'cp1',
      balances: 200,
    });
    mockPrisma.wallet.findUnique.mockResolvedValue({
      walletAddress: '0xcustomer',
      seedPhrase: 'enc',
      derivationIndex: 0,
    });
    mockBlockchain.getMarketplaceListing.mockResolvedValue({
      isActive: true,
      paymentToken: '0xab',
    });
    mockBlockchain.buyCoupon.mockResolvedValue({
      hash: '0xhash',
      blockNumber: 10,
    });
    mockPrisma.wallet.findFirst.mockResolvedValue({
      walletAddress: '0xmerchant',
    });
    mockPrisma.$transaction.mockImplementation(async (ops) => Promise.all(ops));

    await handler.execute('g1', 'p1', '0812345678');

    expect(mockPrisma.transaction.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          merchantId: 'seller-merchant-1',
          receiverId: 'seller-merchant-1',
        }),
      }),
    );
    expect(mockPrisma.transaction.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          merchantId: 'seller-merchant-1',
          senderId: 'seller-merchant-1',
        }),
      }),
    );
  });
});
