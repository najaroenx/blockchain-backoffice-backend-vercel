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
  deriveChildWallet: jest.fn(() => ({ address: '0xaddr', chainCode: 'chain' })),
}));

import {
  NotFoundException,
  BadRequestException,
  ServiceUnavailableException,
  HttpException,
} from '@nestjs/common';
import { RedeemVoucher } from 'src/modules/internal/voucher/handlers/redeemVoucher.handler';

describe('RedeemVoucher', () => {
  let handler: RedeemVoucher;
  let mockPrisma: any;
  let mockBlockchain: any;
  let mockToken: any;
  let mockConfig: any;
  let mockMerchantRef: any;
  let mockAisTransfer: any;

  beforeEach(() => {
    mockPrisma = {
      customer: { findFirst: jest.fn() },
      voucherCode: {
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({
          id: 'vc1',
          code: 'CODE1',
          isUsed: true,
          usedBy: 'c1',
          usedAt: new Date(),
          pointsCost: 100,
          voucher: {},
        }),
      },
      point: { findUnique: jest.fn() },
      merchant: { findUnique: jest.fn(), findFirst: jest.fn() },
      transaction: {
        create: jest.fn().mockResolvedValue({
          id: 'tx1',
          transactionTypeId: 'REDEEM',
          amount: 1,
          createdAt: new Date(),
          transactionRefId: 'tr1',
        }),
      },
      $transaction: jest.fn(),
    };
    mockBlockchain = {
      getUserCouponBalance: jest.fn(),
      redeemVoucher: jest.fn(),
    };
    mockToken = {
      decryptKey: jest.fn().mockReturnValue('decrypted-seed'),
    };
    mockConfig = {
      get: jest.fn().mockReturnValue('test-salt'),
    };
    mockMerchantRef = {
      enrich: jest.fn().mockResolvedValue({ name: 'Store' }),
    };
    mockAisTransfer = {
      transferIn: jest.fn().mockResolvedValue({
        success: true,
        transactionID: 'ais_tx_1',
        data: {},
      }),
      transferReverse: jest.fn().mockResolvedValue({
        success: true,
        transactionID: 'ais_tx_1',
        data: {},
      }),
    };
    handler = new RedeemVoucher(
      mockPrisma as any,
      mockBlockchain as any,
      mockToken as any,
      mockConfig as any,
      mockMerchantRef as any,
      mockAisTransfer as any,
    );
  });

  describe('execute', () => {
    it('should throw NotFoundException when customer not found', async () => {
      mockPrisma.customer.findFirst.mockResolvedValue(null);

      const exception = await handler
        .execute('CODE1', '0812345678', 'ref1')
        .catch((error) => error);

      expect(exception).toBeInstanceOf(NotFoundException);
      expect(exception.getResponse()).toEqual({
        statusCode: 404,
        message: 'Customer with phone 0812345678 not found',
        error: 'Not Found',
      });
    });

    it('should throw NotFoundException when voucher code not found', async () => {
      mockPrisma.customer.findFirst.mockResolvedValue({
        id: 'c1',
        wallet: {
          walletAddress: '0xabc',
          seedPhrase: 'enc',
          derivationIndex: 0,
        },
      });
      mockPrisma.voucherCode.findUnique.mockResolvedValue(null);

      await expect(
        handler.execute('BAD_CODE', '0812345678', 'ref1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when code already used', async () => {
      mockPrisma.customer.findFirst.mockResolvedValue({
        id: 'c1',
        wallet: {
          walletAddress: '0xabc',
          seedPhrase: 'enc',
          derivationIndex: 0,
        },
      });
      mockPrisma.voucherCode.findUnique.mockResolvedValue({
        id: 'vc1',
        isUsed: true,
        usedBy: 'other-customer',
        voucher: {
          id: 'v1',
          merchantRef: 'ref1',
          endDate: null,
          startDate: null,
        },
      });

      await expect(
        handler.execute('CODE1', '0812345678', 'ref1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when merchantRef does not match', async () => {
      mockPrisma.customer.findFirst.mockResolvedValue({
        id: 'c1',
        wallet: {
          walletAddress: '0xabc',
          seedPhrase: 'enc',
          derivationIndex: 0,
        },
      });
      mockPrisma.voucherCode.findUnique.mockResolvedValue({
        id: 'vc1',
        isUsed: false,
        pointId: 'p1',
        voucherGroupId: 'g1',
        currentOwnerId: null,
        voucher: {
          id: 'v1',
          merchantRef: 'different-ref',
          endDate: null,
          startDate: null,
        },
      });

      await expect(
        handler.execute('CODE1', '0812345678', 'ref1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when voucher expired', async () => {
      const pastDate = new Date(Date.now() - 86400000);
      mockPrisma.customer.findFirst.mockResolvedValue({
        id: 'c1',
        wallet: {
          walletAddress: '0xabc',
          seedPhrase: 'enc',
          derivationIndex: 0,
        },
      });
      mockPrisma.voucherCode.findUnique.mockResolvedValue({
        id: 'vc1',
        isUsed: false,
        pointId: 'p1',
        voucherGroupId: 'g1',
        currentOwnerId: null,
        voucher: {
          id: 'v1',
          merchantRef: 'ref1',
          endDate: pastDate,
          startDate: null,
        },
      });

      await expect(
        handler.execute('CODE1', '0812345678', 'ref1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when voucher not yet valid', async () => {
      const futureDate = new Date(Date.now() + 86400000 * 30);
      mockPrisma.customer.findFirst.mockResolvedValue({
        id: 'c1',
        wallet: {
          walletAddress: '0xabc',
          seedPhrase: 'enc',
          derivationIndex: 0,
        },
      });
      mockPrisma.voucherCode.findUnique.mockResolvedValue({
        id: 'vc1',
        isUsed: false,
        pointId: 'p1',
        voucherGroupId: 'g1',
        currentOwnerId: null,
        voucher: {
          id: 'v1',
          merchantRef: 'ref1',
          endDate: null,
          startDate: futureDate,
        },
      });

      await expect(
        handler.execute('CODE1', '0812345678', 'ref1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when no pointId', async () => {
      mockPrisma.customer.findFirst.mockResolvedValue({
        id: 'c1',
        wallet: {
          walletAddress: '0xabc',
          seedPhrase: 'enc',
          derivationIndex: 0,
        },
      });
      mockPrisma.voucherCode.findUnique.mockResolvedValue({
        id: 'vc1',
        isUsed: false,
        pointId: null,
        voucherGroupId: 'g1',
        currentOwnerId: null,
        voucher: {
          id: 'v1',
          merchantRef: 'ref1',
          endDate: null,
          startDate: null,
        },
      });

      await expect(
        handler.execute('CODE1', '0812345678', 'ref1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when code not activated', async () => {
      mockPrisma.customer.findFirst.mockResolvedValue({
        id: 'c1',
        wallet: {
          walletAddress: '0xabc',
          seedPhrase: 'enc',
          derivationIndex: 0,
        },
      });
      mockPrisma.voucherCode.findUnique.mockResolvedValue({
        id: 'vc1',
        isUsed: false,
        pointId: 'p1',
        voucherGroupId: null,
        currentOwnerId: null,
        voucher: {
          id: 'v1',
          merchantRef: 'ref1',
          endDate: null,
          startDate: null,
        },
      });

      await expect(
        handler.execute('CODE1', '0812345678', 'ref1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when code owned by another customer', async () => {
      mockPrisma.customer.findFirst.mockResolvedValue({
        id: 'c1',
        wallet: {
          walletAddress: '0xabc',
          seedPhrase: 'enc',
          derivationIndex: 0,
        },
      });
      mockPrisma.voucherCode.findUnique.mockResolvedValue({
        id: 'vc1',
        isUsed: false,
        pointId: 'p1',
        voucherGroupId: 'g1',
        currentOwnerId: 'other-customer',
        currentOwnerType: 'CUSTOMER',
        voucher: {
          id: 'v1',
          merchantRef: 'ref1',
          endDate: null,
          startDate: null,
        },
      });

      await expect(
        handler.execute('CODE1', '0812345678', 'ref1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should resolve sellerMerchantId when voucher merchantId is null', async () => {
      mockPrisma.customer.findFirst.mockResolvedValue({
        id: 'c1',
        tel: '0812345678',
        wallet: {
          walletAddress: '0xabc',
          seedPhrase: 'enc',
          derivationIndex: 0,
        },
      });
      mockPrisma.voucherCode.findUnique.mockResolvedValue({
        id: 'vc1',
        code: 'CODE1',
        isUsed: false,
        pointId: 'p1',
        voucherGroupId: 'g1',
        currentOwnerId: 'c1',
        currentOwnerType: 'CUSTOMER',
        voucher: {
          id: 'v1',
          merchantId: null,
          sellerMerchantId: 'seller-merchant-1',
          merchantName: 'Seller Merchant',
          merchantRef: 'ref1',
          endDate: null,
          startDate: null,
          tokenId: '10',
          valueType: 'cash',
          value: 100,
          currency: 'PTS',
          description: 'Seller voucher',
          imageUrl: null,
          merchant: null,
        },
      });
      mockPrisma.point.findUnique.mockResolvedValue({
        merchantId: null,
      });
      mockPrisma.merchant.findUnique.mockResolvedValue({
        id: 'seller-merchant-1',
        name: 'Seller Merchant',
        imageUrl: null,
        website: null,
        wallet: {
          walletAddress: '0xmerchant',
        },
      });
      mockBlockchain.getUserCouponBalance.mockResolvedValue({ balance: '1' });
      mockBlockchain.redeemVoucher.mockResolvedValue({ hash: '0xredeem' });
      mockPrisma.$transaction.mockResolvedValue([
        {
          id: 'vc1',
          code: 'CODE1',
          isUsed: true,
          usedBy: 'c1',
          usedAt: new Date(),
          pointsCost: 100,
          voucher: {},
        },
        {
          id: 'tx1',
          transactionTypeId: 'REDEEM',
          amount: 1,
          createdAt: new Date(),
          transactionRefId: 'tr1',
        },
      ]);

      const result = await handler.execute('CODE1', '0812345678', 'ref1');

      expect(mockPrisma.merchant.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'seller-merchant-1' },
        }),
      );
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.transaction.receiverId).toBe('seller-merchant-1');
    });

    it('should throw NotFoundException when customer wallet not configured', async () => {
      mockPrisma.customer.findFirst.mockResolvedValue({
        id: 'c1',
        wallet: null,
      });
      mockPrisma.voucherCode.findUnique.mockResolvedValue({
        id: 'vc1',
        isUsed: false,
        pointId: 'p1',
        voucherGroupId: 'g1',
        currentOwnerId: null,
        voucher: {
          id: 'v1',
          merchantRef: 'ref1',
          endDate: null,
          startDate: null,
          tokenId: '1',
          merchantId: 'm1',
        },
      });

      await expect(
        handler.execute('CODE1', '0812345678', 'ref1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException on insufficient on-chain balance', async () => {
      mockPrisma.customer.findFirst.mockResolvedValue({
        id: 'c1',
        wallet: {
          walletAddress: '0xabc123',
          seedPhrase: 'enc-seed',
          derivationIndex: 0,
        },
      });
      mockPrisma.voucherCode.findUnique.mockResolvedValue({
        id: 'vc1',
        isUsed: false,
        pointId: 'p1',
        voucherGroupId: 'g1',
        currentOwnerId: 'c1',
        currentOwnerType: 'CUSTOMER',
        voucher: {
          id: 'v1',
          tokenId: '1',
          merchantRef: 'ref1',
          endDate: null,
          startDate: null,
          merchantId: 'm1',
        },
      });
      mockBlockchain.getUserCouponBalance.mockResolvedValue({ balance: '0' });

      await expect(
        handler.execute('CODE1', '0812345678', 'ref1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException on blockchain redeem failure', async () => {
      mockPrisma.customer.findFirst.mockResolvedValue({
        id: 'c1',
        wallet: {
          walletAddress: '0xabc123',
          seedPhrase: 'enc-seed',
          derivationIndex: 0,
        },
      });
      mockPrisma.voucherCode.findUnique.mockResolvedValue({
        id: 'vc1',
        isUsed: false,
        pointId: 'p1',
        voucherGroupId: 'g1',
        currentOwnerId: null,
        voucher: {
          id: 'v1',
          tokenId: '1',
          merchantRef: 'ref1',
          endDate: null,
          startDate: null,
          merchantId: 'm1',
        },
      });
      mockBlockchain.getUserCouponBalance.mockResolvedValue({ balance: '5' });
      mockBlockchain.redeemVoucher.mockRejectedValue(new Error('tx reverted'));

      await expect(
        handler.execute('CODE1', '0812345678', 'ref1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully redeem voucher', async () => {
      mockPrisma.customer.findFirst.mockResolvedValue({
        id: 'c1',
        tel: '0812345678',
        wallet: {
          walletAddress: '0xabc123',
          seedPhrase: 'enc-seed',
          derivationIndex: 0,
        },
      });
      mockPrisma.voucherCode.findUnique.mockResolvedValue({
        id: 'vc1',
        code: 'CODE1',
        isUsed: false,
        pointId: 'p1',
        voucherGroupId: 'g1',
        currentOwnerId: null,
        currentOwnerType: null,
        currency: 'POINTS',
        voucher: {
          id: 'v1',
          tokenId: '1',
          merchantRef: 'ref1',
          name: 'Test Voucher',
          description: 'Desc',
          imageUrl: null,
          status: 'active',
          endDate: new Date(Date.now() + 86400000),
          startDate: null,
          valueType: 'fixed',
          value: 100,
          currency: 'THB',
          totalRedeemed: 0,
          merchantId: 'm1',
          merchantName: 'TestMerchant',
          merchant: {
            id: 'm1',
            name: 'TestMerchant',
            description: '',
            imageUrl: null,
          },
        },
      });
      mockBlockchain.getUserCouponBalance.mockResolvedValue({ balance: '5' });
      mockBlockchain.redeemVoucher.mockResolvedValue({
        hash: '0xhash123',
        blockNumber: 100,
      });
      mockPrisma.merchant.findUnique.mockResolvedValue({
        walletId: 'w1',
        name: 'TestMerchant',
        imageUrl: null,
        website: null,
        wallet: { walletAddress: '0xmerchant' },
      });
      mockPrisma.$transaction.mockImplementation(async (ops) => {
        // $transaction with array returns array of resolved promises
        return Promise.all(ops);
      });

      const result = await handler.execute('CODE1', '0812345678', 'ref1');
      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(200);
      expect(result.message).toContain('successfully');
      expect(result.blockchain).toBeDefined();
    });
  });

  describe('validateCode', () => {
    it('should return invalid for non-existent code', async () => {
      mockPrisma.voucherCode.findUnique.mockResolvedValue(null);
      const result = await handler.validateCode('BAD');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Code not found');
    });

    it('should return invalid for already redeemed code', async () => {
      mockPrisma.voucherCode.findUnique.mockResolvedValue({
        isUsed: true,
        usedBy: 'c1',
        usedAt: new Date(),
        voucher: {
          endDate: null,
          startDate: null,
          merchantRef: null,
          merchant: null,
        },
      });
      const result = await handler.validateCode('USED');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Code already redeemed');
    });

    it('should return invalid for expired voucher', async () => {
      mockPrisma.voucherCode.findUnique.mockResolvedValue({
        isUsed: false,
        voucher: {
          endDate: new Date(Date.now() - 86400000),
          startDate: null,
          merchantRef: null,
          merchant: null,
        },
      });
      const result = await handler.validateCode('EXPIRED');
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Voucher expired');
    });

    it('should return valid for good code', async () => {
      mockPrisma.voucherCode.findUnique.mockResolvedValue({
        isUsed: false,
        pointsCost: 50,
        voucher: {
          id: 'v1',
          name: 'Test',
          description: 'Desc',
          valueType: 'fixed',
          value: 100,
          endDate: new Date(Date.now() + 86400000),
          startDate: null,
          merchantRef: null,
          merchantName: 'M1',
          merchant: { name: 'M1' },
        },
      });
      const result = await handler.validateCode('GOOD');
      expect(result.valid).toBe(true);
      expect(result.pointsCost).toBe(50);
    });
  });

  describe('executeAIS', () => {
    it('should redeem AIS voucher for external receiver without pointId', async () => {
      mockPrisma.customer.findFirst.mockResolvedValue({
        id: 'c1',
        tel: '0812345678',
        wallet: {
          walletAddress: '0xabc123',
          seedPhrase: 'enc-seed',
          derivationIndex: 0,
        },
      });
      mockPrisma.voucherCode.findUnique
        .mockResolvedValueOnce({
          voucher: { valueType: 'aispoint', value: 100 },
        })
        .mockResolvedValueOnce({
          id: 'vc1',
          code: 'CODE1',
          isUsed: false,
          pointId: null,
          voucherGroupId: 'g1',
          currentOwnerId: null,
          currentOwnerType: null,
          currency: null,
          voucher: {
            id: 'v1',
            tokenId: '1',
            merchantRef: 'ref1',
            name: 'AIS Voucher',
            description: 'AIS Desc',
            imageUrl: null,
            status: 'active',
            endDate: new Date(Date.now() + 86400000),
            startDate: null,
            valueType: 'aispoint',
            value: 100,
            currency: null,
            totalRedeemed: 0,
            merchantId: 'm1',
            merchantName: 'TestMerchant',
            merchant: {
              id: 'm1',
              name: 'TestMerchant',
              description: '',
              imageUrl: null,
            },
          },
        });
      mockBlockchain.getUserCouponBalance.mockResolvedValue({ balance: '5' });
      mockBlockchain.redeemVoucher.mockResolvedValue({
        hash: '0xhash123',
        blockNumber: 100,
      });
      mockPrisma.merchant.findUnique.mockResolvedValue({
        walletId: 'w1',
        name: 'TestMerchant',
        imageUrl: null,
        website: null,
        wallet: { walletAddress: '0xmerchant' },
      });
      mockPrisma.$transaction.mockImplementation(async (ops) =>
        Promise.all(ops),
      );

      const result = await handler.executeAIS(
        'CODE1',
        '0812345678',
        'ref1',
        '0899999999',
      );

      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(200);
      expect(result.transaction.point).toBeNull();
      expect(result.pointTransfer.receiverPhone).toBe('0899999999');
      expect(mockAisTransfer.transferIn).toHaveBeenCalledWith(
        expect.objectContaining({
          msisdn: '0899999999',
          points: 100,
        }),
      );
      expect(
        mockBlockchain.getUserCouponBalance.mock.invocationCallOrder[0],
      ).toBeLessThan(mockAisTransfer.transferIn.mock.invocationCallOrder[0]);
      expect(
        mockAisTransfer.transferIn.mock.invocationCallOrder[0],
      ).toBeLessThan(mockBlockchain.redeemVoucher.mock.invocationCallOrder[0]);
      expect(mockPrisma.customer.findFirst).not.toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tel: '0899999999' },
        }),
      );
    });

    it('should resolve merchant by fallback name when AIS voucher has no merchantId and no pointId', async () => {
      mockPrisma.customer.findFirst.mockResolvedValue({
        id: 'c1',
        tel: '0812345678',
        wallet: {
          walletAddress: '0xabc123',
          seedPhrase: 'enc-seed',
          derivationIndex: 0,
        },
      });
      mockPrisma.voucherCode.findUnique
        .mockResolvedValueOnce({
          voucher: { valueType: 'aispoint', value: 50 },
        })
        .mockResolvedValueOnce({
          id: 'vc1',
          code: 'CODE1',
          isUsed: false,
          pointId: null,
          voucherGroupId: 'g1',
          currentOwnerId: null,
          currentOwnerType: null,
          currency: null,
          voucher: {
            id: 'v1',
            tokenId: '1',
            merchantRef: 'ref1',
            name: 'AIS Voucher',
            description: 'AIS Desc',
            imageUrl: null,
            status: 'active',
            endDate: new Date(Date.now() + 86400000),
            startDate: null,
            valueType: 'aispoint',
            value: 50,
            currency: null,
            totalRedeemed: 0,
            merchantId: null,
            merchantName: 'Fallback Merchant',
            merchant: null,
          },
        });
      mockBlockchain.getUserCouponBalance.mockResolvedValue({ balance: '5' });
      mockBlockchain.redeemVoucher.mockResolvedValue({
        hash: '0xhash123',
        blockNumber: 100,
      });
      mockMerchantRef.enrich.mockResolvedValue({ name: 'Fallback Merchant' });
      mockPrisma.merchant.findFirst.mockResolvedValue({
        id: 'm-fallback',
        walletId: 'w1',
        name: 'Fallback Merchant',
        imageUrl: null,
        website: null,
        wallet: { walletAddress: '0xmerchant' },
      });
      mockPrisma.$transaction.mockImplementation(async (ops) =>
        Promise.all(ops),
      );

      const result = await handler.executeAIS(
        'CODE1',
        '0812345678',
        'ref1',
        '0899999999',
      );

      expect(result.success).toBe(true);
      expect(result.transaction.receiverId).toBe('m-fallback');
      expect(mockPrisma.merchant.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [{ name: 'Fallback Merchant' }],
          },
        }),
      );
    });

    it('should prefer point merchant over voucher merchant metadata during redemption', async () => {
      mockPrisma.customer.findFirst.mockResolvedValue({
        id: 'c1',
        tel: '0812345678',
        wallet: {
          walletAddress: '0xabc123',
          seedPhrase: 'enc-seed',
          derivationIndex: 0,
        },
      });
      mockPrisma.voucherCode.findUnique.mockResolvedValue({
        id: 'vc1',
        code: 'CODE1',
        isUsed: false,
        pointId: 'point-1',
        voucherGroupId: 'g1',
        currentOwnerId: null,
        currentOwnerType: null,
        currency: 'POINT',
        voucher: {
          id: 'v1',
          tokenId: '1',
          merchantRef: 'ref1',
          name: 'Test Voucher',
          description: 'Desc',
          imageUrl: null,
          status: 'active',
          endDate: new Date(Date.now() + 86400000),
          startDate: null,
          valueType: 'fixed',
          value: 100,
          currency: 'POINT',
          totalRedeemed: 0,
          merchantId: 'voucher-merchant',
          merchantName: 'Voucher Merchant',
          merchant: {
            id: 'voucher-merchant',
            name: 'Voucher Merchant',
            description: '',
            imageUrl: null,
          },
        },
      });
      mockPrisma.point.findUnique.mockResolvedValue({
        merchantId: 'point-merchant',
      });
      mockBlockchain.getUserCouponBalance.mockResolvedValue({ balance: '5' });
      mockBlockchain.redeemVoucher.mockResolvedValue({
        hash: '0xhash123',
        blockNumber: 100,
      });
      mockPrisma.merchant.findUnique.mockResolvedValue({
        id: 'point-merchant',
        walletId: 'w1',
        name: 'Point Merchant',
        imageUrl: null,
        website: null,
        wallet: { walletAddress: '0xmerchant' },
      });
      mockPrisma.$transaction.mockImplementation(async (ops) =>
        Promise.all(ops),
      );

      const result = await handler.execute('CODE1', '0812345678', 'ref1');

      expect(result.success).toBe(true);
      expect(result.transaction.receiverId).toBe('point-merchant');
      expect(mockPrisma.point.findUnique).toHaveBeenCalledWith({
        where: { id: 'point-1' },
        select: { merchantId: true },
      });
      expect(mockPrisma.merchant.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'point-merchant' },
        }),
      );
      expect(mockPrisma.merchant.findFirst).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when voucher is not aispoint', async () => {
      mockPrisma.voucherCode.findUnique.mockResolvedValue({
        voucher: { valueType: 'fixed', value: 100 },
      });

      await expect(
        handler.executeAIS('CODE1', '0812345678', 'ref1', '0899999999'),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.customer.findFirst).not.toHaveBeenCalled();
    });

    it('should stop before blockchain when AIS transfer-in returns failure', async () => {
      mockPrisma.customer.findFirst.mockResolvedValue({
        id: 'c1',
        tel: '0812345678',
        wallet: {
          walletAddress: '0xabc123',
          seedPhrase: 'enc-seed',
          derivationIndex: 0,
        },
      });
      mockPrisma.voucherCode.findUnique
        .mockResolvedValueOnce({
          voucher: { valueType: 'aispoint', value: 50 },
        })
        .mockResolvedValueOnce({
          id: 'vc1',
          code: 'CODE1',
          isUsed: false,
          pointId: null,
          voucherGroupId: 'g1',
          currentOwnerId: null,
          currentOwnerType: null,
          currency: null,
          voucher: {
            id: 'v1',
            tokenId: '1',
            merchantRef: 'ref1',
            name: 'AIS Voucher',
            description: 'AIS Desc',
            imageUrl: null,
            status: 'active',
            endDate: new Date(Date.now() + 86400000),
            startDate: null,
            valueType: 'aispoint',
            value: 50,
            currency: null,
            totalRedeemed: 0,
            merchantId: 'm1',
            merchantName: 'TestMerchant',
            merchant: {
              id: 'm1',
              name: 'TestMerchant',
              description: '',
              imageUrl: null,
            },
          },
        });
      mockAisTransfer.transferIn.mockResolvedValue({
        success: false,
        transactionID: 'ais_tx_failed',
        error:
          'AIS API error: HTTP 200 OK, AIS status=E0004, message=MSISDN NOT FOUND',
        data: {
          status: 'E0004',
          description: 'MSISDN NOT FOUND',
          msg_th:
            'สงวนสิทธิ์สำหรับลูกค้าเอไอเอสรายบุคคล และลูกค้าเอไอเอส ประเภท SMEs ที่สมัครเข้าร่วมโครงการ เอไอเอส พอยท์ แล้วเท่านั้น',
          msg_en:
            'AIS points conversion program is for AIS individual /AIS residential customers and registered SMEs only.',
        },
      });
      mockBlockchain.getUserCouponBalance.mockResolvedValue({ balance: '5' });

      const execution = handler.executeAIS(
        'CODE1',
        '0812345678',
        'ref1',
        '0899999999',
      );
      const exception = await execution.catch((error) => error);

      expect(exception).toBeInstanceOf(BadRequestException);
      expect(exception.getResponse()).toMatchObject({
        statusCode: 400,
        code: 'AIS_TRANSFER_FAILED',
        message:
          'AIS points conversion program is for AIS individual /AIS residential customers and registered SMEs only. / สงวนสิทธิ์สำหรับลูกค้าเอไอเอสรายบุคคล และลูกค้าเอไอเอส ประเภท SMEs ที่สมัครเข้าร่วมโครงการ เอไอเอส พอยท์ แล้วเท่านั้น',
        details: {
          stage: 'ais_transfer_in',
          receiverPhone: '0899999999',
          rollback: {
            attempted: false,
            succeeded: false,
          },
          ais: {
            success: false,
            displayMessage:
              'AIS points conversion program is for AIS individual /AIS residential customers and registered SMEs only. / สงวนสิทธิ์สำหรับลูกค้าเอไอเอสรายบุคคล และลูกค้าเอไอเอส ประเภท SMEs ที่สมัครเข้าร่วมโครงการ เอไอเอส พอยท์ แล้วเท่านั้น',
            error:
              'AIS API error: HTTP 200 OK, AIS status=E0004, message=MSISDN NOT FOUND',
            data: {
              status: 'E0004',
              description: 'MSISDN NOT FOUND',
              msg_th:
                'สงวนสิทธิ์สำหรับลูกค้าเอไอเอสรายบุคคล และลูกค้าเอไอเอส ประเภท SMEs ที่สมัครเข้าร่วมโครงการ เอไอเอส พอยท์ แล้วเท่านั้น',
              msg_en:
                'AIS points conversion program is for AIS individual /AIS residential customers and registered SMEs only.',
            },
          },
        },
      });

      expect(mockBlockchain.getUserCouponBalance).toHaveBeenCalledTimes(1);
      expect(mockBlockchain.redeemVoucher).not.toHaveBeenCalled();
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(mockAisTransfer.transferReverse).not.toHaveBeenCalled();
    });

    it('should reverse AIS transfer when blockchain fails after transfer-in success', async () => {
      mockPrisma.customer.findFirst.mockResolvedValue({
        id: 'c1',
        tel: '0812345678',
        wallet: {
          walletAddress: '0xabc123',
          seedPhrase: 'enc-seed',
          derivationIndex: 0,
        },
      });
      mockPrisma.voucherCode.findUnique
        .mockResolvedValueOnce({
          voucher: { valueType: 'aispoint', value: 50 },
        })
        .mockResolvedValueOnce({
          id: 'vc1',
          code: 'CODE1',
          isUsed: false,
          pointId: null,
          voucherGroupId: 'g1',
          currentOwnerId: null,
          currentOwnerType: null,
          currency: null,
          voucher: {
            id: 'v1',
            tokenId: '1',
            merchantRef: 'ref1',
            name: 'AIS Voucher',
            description: 'AIS Desc',
            imageUrl: null,
            status: 'active',
            endDate: new Date(Date.now() + 86400000),
            startDate: null,
            valueType: 'aispoint',
            value: 50,
            currency: null,
            totalRedeemed: 0,
            merchantId: 'm1',
            merchantName: 'TestMerchant',
            merchant: {
              id: 'm1',
              name: 'TestMerchant',
              description: '',
              imageUrl: null,
            },
          },
        });
      mockBlockchain.getUserCouponBalance.mockResolvedValue({ balance: '5' });
      mockBlockchain.redeemVoucher.mockRejectedValue(
        new Error('chain exploded'),
      );

      const execution = handler.executeAIS(
        'CODE1',
        '0812345678',
        'ref1',
        '0899999999',
      );
      const exception = await execution.catch((error) => error);

      expect(exception).toBeInstanceOf(HttpException);
      expect(exception.getResponse()).toMatchObject({
        statusCode: 400,
        code: 'AIS_REDEEM_ROLLED_BACK',
        message:
          'Blockchain or persistence failed after AIS transfer, but rollback completed',
        details: {
          stage: 'blockchain_or_persistence',
          receiverPhone: '0899999999',
          rollback: {
            attempted: true,
            succeeded: true,
          },
          originalError: {
            statusCode: 400,
            message: 'Failed to redeem voucher on blockchain: chain exploded',
            error: 'Bad Request',
          },
        },
      });

      expect(mockAisTransfer.transferIn).toHaveBeenCalledTimes(1);
      expect(mockAisTransfer.transferReverse).toHaveBeenCalledTimes(1);
      expect(mockAisTransfer.transferReverse).toHaveBeenCalledWith(
        expect.objectContaining({
          msisdn: '0899999999',
        }),
      );
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('should surface manual reconciliation error when reverse also fails', async () => {
      mockPrisma.customer.findFirst.mockResolvedValue({
        id: 'c1',
        tel: '0812345678',
        wallet: {
          walletAddress: '0xabc123',
          seedPhrase: 'enc-seed',
          derivationIndex: 0,
        },
      });
      mockPrisma.voucherCode.findUnique
        .mockResolvedValueOnce({
          voucher: { valueType: 'aispoint', value: 50 },
        })
        .mockResolvedValueOnce({
          id: 'vc1',
          code: 'CODE1',
          isUsed: false,
          pointId: null,
          voucherGroupId: 'g1',
          currentOwnerId: null,
          currentOwnerType: null,
          currency: null,
          voucher: {
            id: 'v1',
            tokenId: '1',
            merchantRef: 'ref1',
            name: 'AIS Voucher',
            description: 'AIS Desc',
            imageUrl: null,
            status: 'active',
            endDate: new Date(Date.now() + 86400000),
            startDate: null,
            valueType: 'aispoint',
            value: 50,
            currency: null,
            totalRedeemed: 0,
            merchantId: 'm1',
            merchantName: 'TestMerchant',
            merchant: {
              id: 'm1',
              name: 'TestMerchant',
              description: '',
              imageUrl: null,
            },
          },
        });
      mockBlockchain.getUserCouponBalance.mockResolvedValue({ balance: '5' });
      mockBlockchain.redeemVoucher.mockRejectedValue(
        new Error('chain exploded'),
      );
      mockAisTransfer.transferReverse.mockRejectedValue(
        new Error('reverse exploded'),
      );

      const execution = handler.executeAIS(
        'CODE1',
        '0812345678',
        'ref1',
        '0899999999',
      );

      const exception = await execution.catch((error) => error);

      expect(exception).toBeInstanceOf(ServiceUnavailableException);
      expect(exception.getResponse()).toMatchObject({
        statusCode: 503,
        code: 'AIS_ROLLBACK_FAILED',
        message:
          'AIS transferred but rollback failed, manual reconciliation required',
        details: {
          stage: 'rollback',
          receiverPhone: '0899999999',
          rollback: {
            attempted: true,
            succeeded: false,
            error: {
              statusCode: 500,
              message: 'reverse exploded',
            },
          },
          originalError: {
            statusCode: 400,
            message: 'Failed to redeem voucher on blockchain: chain exploded',
          },
        },
      });
    });
  });
});
