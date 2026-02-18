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

import { NotFoundException, BadRequestException } from '@nestjs/common';
import { RedeemVoucher } from 'src/modules/internal/voucher/handlers/redeemVoucher.handler';

describe('RedeemVoucher', () => {
  let handler: RedeemVoucher;
  let mockPrisma: any;
  let mockBlockchain: any;
  let mockToken: any;
  let mockConfig: any;
  let mockMerchantRef: any;

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
      merchant: { findUnique: jest.fn() },
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
    handler = new RedeemVoucher(
      mockPrisma as any,
      mockBlockchain as any,
      mockToken as any,
      mockConfig as any,
      mockMerchantRef as any,
    );
  });

  describe('execute', () => {
    it('should throw NotFoundException when customer not found', async () => {
      mockPrisma.customer.findFirst.mockResolvedValue(null);

      await expect(
        handler.execute('CODE1', '0812345678', 'ref1'),
      ).rejects.toThrow(NotFoundException);
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
    it('should throw NotFoundException when receiver not found', async () => {
      mockPrisma.customer.findFirst
        .mockResolvedValueOnce({ id: 'c1', wallet: {} }) // redeemer found
        .mockResolvedValueOnce(null); // receiver not found

      await expect(
        handler.executeAIS('CODE1', '0812345678', 'ref1', '0899999999'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when voucher is not aispoint', async () => {
      mockPrisma.customer.findFirst
        .mockResolvedValueOnce({ id: 'c1', wallet: {} })
        .mockResolvedValueOnce({ id: 'c2', wallet: {} });
      mockPrisma.voucherCode.findUnique.mockResolvedValue({
        voucher: { valueType: 'fixed', value: 100 },
      });

      await expect(
        handler.executeAIS('CODE1', '0812345678', 'ref1', '0899999999'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
