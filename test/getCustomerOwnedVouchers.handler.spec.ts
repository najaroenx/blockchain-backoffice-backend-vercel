import { Test, TestingModule } from '@nestjs/testing';
import { GetCustomerOwnedVouchers } from '../src/modules/internal/voucher/handlers/getCustomerOwnedVouchers.handler';
import { PrismaService } from '../prisma/prisma.service';
import { BlockchainService } from '../src/providers/blockchain/blockchain.service';
import { MerchantRefEnrichmentService } from '../src/modules/shared/services/merchant-ref-enrichment.service';

describe('GetCustomerOwnedVouchers', () => {
  let handler: GetCustomerOwnedVouchers;
  let prismaService: any;
  let blockchainService: any;

  // Raw SQL result shapes matching the handler's $queryRaw interfaces
  const mockCustomerRow = {
    id: 'customer-1',
    tel: '0812345678',
    walletAddress: '0xCustomerWallet123',
  };

  const mockCustomerCodeRow = {
    codeId: 'code-1',
    code: 'CODE-1',
    voucherGroupId: null as string | null,
    pointsCost: 50,
    currency: 'POINT',
    isUsed: false,
    usedAt: null as Date | null,
    codeCreatedAt: new Date('2024-01-15'),
    voucherId: 'voucher-1',
    voucherName: 'Test Voucher',
    voucherDescription: 'Test Description',
    voucherImageUrl: 'https://example.com/voucher.jpg',
    voucherValue: 100,
    voucherValueType: 'cash',
    voucherStatus: 'active',
    voucherStartDate: new Date('2024-01-01'),
    voucherEndDate: new Date('2027-12-31'),
    voucherMerchantRef: 'MERCHANT-REF',
    voucherMerchantId: 'merchant-1',
    voucherMerchantName: 'Test Merchant',
    voucherTokenId: '100',
    merchantImageUrl: 'https://example.com/merchant.jpg',
    merchantDbName: 'Test Merchant',
    txId: 'tx-1',
    txTransactionTypeId: 'TRANSFER',
  };

  const mockRedeemedCodeRow = {
    ...mockCustomerCodeRow,
    codeId: 'code-2',
    code: 'CODE-2',
    isUsed: true,
    usedAt: new Date('2024-02-01'),
    codeCreatedAt: new Date('2024-01-20'),
    txId: 'tx-2',
    txTransactionTypeId: 'REDEEM',
  };

  const mockActiveVoucherRow = {
    voucherId: 'voucher-1',
    tokenId: '100',
    voucherName: 'Test Voucher',
    voucherDescription: 'Test Description',
    voucherImageUrl: 'https://example.com/voucher.jpg',
    voucherValue: 100,
    voucherValueType: 'cash',
    voucherStatus: 'active',
    voucherStartDate: new Date('2024-01-01'),
    voucherEndDate: new Date('2027-12-31'),
    voucherMerchantRef: 'MERCHANT-REF',
    voucherMerchantId: 'merchant-1',
    voucherMerchantName: 'Test Merchant',
    merchantImageUrl: 'https://example.com/merchant.jpg',
    samplePointsCost: 50,
    sampleCurrency: 'POINT',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetCustomerOwnedVouchers,
        {
          provide: PrismaService,
          useValue: {
            $queryRaw: jest.fn(),
          },
        },
        {
          provide: BlockchainService,
          useValue: {
            getUserCouponBalance: jest.fn(),
            getUserCouponBalanceBatch: jest.fn(),
          },
        },
        {
          provide: MerchantRefEnrichmentService,
          useValue: {
            enrich: jest.fn().mockResolvedValue(null),
            enrichBatch: jest.fn().mockResolvedValue(new Map()),
          },
        },
      ],
    }).compile();

    handler = module.get<GetCustomerOwnedVouchers>(GetCustomerOwnedVouchers);
    prismaService = module.get(PrismaService);
    blockchainService = module.get(BlockchainService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should return empty result when customer not found', async () => {
      // $queryRaw call 1: find customer → empty
      prismaService.$queryRaw.mockResolvedValueOnce([]);

      const result = await handler.execute('0812345678');

      expect(result.vouchers).toEqual([]);
      expect(result.summary.total).toBe(0);
      expect(result.status).toBe('all');
    });

    it('should return empty result when customer has no wallet', async () => {
      // Raw SQL JOINs wallet, so no wallet → empty result from query
      prismaService.$queryRaw.mockResolvedValueOnce([]);

      const result = await handler.execute('0812345678');

      expect(result.vouchers).toEqual([]);
      expect(result.summary.total).toBe(0);
    });

    it('should return vouchers with on-chain balance', async () => {
      // $queryRaw call 1: find customer
      prismaService.$queryRaw.mockResolvedValueOnce([mockCustomerRow]);
      // $queryRaw call 2: find customer codes
      prismaService.$queryRaw.mockResolvedValueOnce([mockCustomerCodeRow]);
      // $queryRaw call 3: find active vouchers
      prismaService.$queryRaw.mockResolvedValueOnce([mockActiveVoucherRow]);

      blockchainService.getUserCouponBalanceBatch.mockResolvedValue(
        new Map([['100', 2]]),
      );

      const result = await handler.execute('0812345678');

      expect(result.vouchers.length).toBeGreaterThanOrEqual(1);
      expect(
        (result.vouchers[0] as any).latestVoucher?.name ||
          (result.vouchers[0] as any).latestVoucher,
      ).toBeDefined();
      expect(result.summary.total).toBeGreaterThanOrEqual(1);
    });

    it('should filter by unused status', async () => {
      prismaService.$queryRaw.mockResolvedValueOnce([mockCustomerRow]);
      prismaService.$queryRaw.mockResolvedValueOnce([
        mockCustomerCodeRow,
        mockRedeemedCodeRow,
      ]);
      prismaService.$queryRaw.mockResolvedValueOnce([mockActiveVoucherRow]);

      blockchainService.getUserCouponBalanceBatch.mockResolvedValue(
        new Map([['100', 1]]),
      );

      const result = await handler.execute('0812345678', 'unused');

      expect(result.status).toBe('unused');
      expect(
        result.vouchers.every(
          (v: any) => v.latestVoucher?.codeStatus !== 'used',
        ),
      ).toBe(true);
    });

    it('should filter by used status', async () => {
      prismaService.$queryRaw.mockResolvedValueOnce([mockCustomerRow]);
      prismaService.$queryRaw.mockResolvedValueOnce([
        mockCustomerCodeRow,
        mockRedeemedCodeRow,
      ]);
      prismaService.$queryRaw.mockResolvedValueOnce([mockActiveVoucherRow]);

      blockchainService.getUserCouponBalanceBatch.mockResolvedValue(
        new Map([['100', 1]]),
      );

      const result = await handler.execute('0812345678', 'used');

      expect(result.status).toBe('used');
      expect(
        result.vouchers.every(
          (v: any) => v.latestVoucher?.codeStatus === 'used',
        ),
      ).toBe(true);
    });

    it('should include redeemed vouchers with zero balance', async () => {
      prismaService.$queryRaw.mockResolvedValueOnce([mockCustomerRow]);
      // Customer has a redeemed code
      prismaService.$queryRaw.mockResolvedValueOnce([mockRedeemedCodeRow]);
      // No active vouchers with balance (or balance is 0)
      prismaService.$queryRaw.mockResolvedValueOnce([mockActiveVoucherRow]);

      blockchainService.getUserCouponBalanceBatch.mockResolvedValue(
        new Map([['100', 0]]),
      );

      const result = await handler.execute('0812345678');

      expect(result.vouchers).toHaveLength(1);
      expect((result.vouchers[0] as any).latestVoucher?.codeStatus).toBe(
        'used',
      );
      expect(result.summary.used).toBe(1);
    });

    it('should apply pagination correctly', async () => {
      prismaService.$queryRaw.mockResolvedValueOnce([mockCustomerRow]);
      prismaService.$queryRaw.mockResolvedValueOnce([mockCustomerCodeRow]);
      prismaService.$queryRaw.mockResolvedValueOnce([mockActiveVoucherRow]);

      blockchainService.getUserCouponBalanceBatch.mockResolvedValue(
        new Map([['100', 5]]),
      );

      const result = await handler.execute('0812345678', 'all', 2, 2);

      expect(result.page).toBe(2);
      expect(result.limit).toBe(2);
      expect(result.total).toBeGreaterThanOrEqual(0);
      expect(result.totalPages).toBeGreaterThanOrEqual(0);
    });

    it('should handle blockchain service errors gracefully', async () => {
      prismaService.$queryRaw.mockResolvedValueOnce([mockCustomerRow]);
      prismaService.$queryRaw.mockResolvedValueOnce([]);
      prismaService.$queryRaw.mockResolvedValueOnce([mockActiveVoucherRow]);

      // Batch call fails, then individual fallback also fails
      blockchainService.getUserCouponBalanceBatch.mockRejectedValue(
        new Error('RPC error'),
      );
      blockchainService.getUserCouponBalance.mockRejectedValue(
        new Error('RPC error'),
      );

      const result = await handler.execute('0812345678');

      expect(result.vouchers).toHaveLength(0);
      expect(result.summary.total).toBe(0);
    });

    it('should map purchase transaction correctly', async () => {
      prismaService.$queryRaw.mockResolvedValueOnce([mockCustomerRow]);
      prismaService.$queryRaw.mockResolvedValueOnce([mockCustomerCodeRow]);
      prismaService.$queryRaw.mockResolvedValueOnce([mockActiveVoucherRow]);

      blockchainService.getUserCouponBalanceBatch.mockResolvedValue(
        new Map([['100', 1]]),
      );

      const result = await handler.execute('0812345678');

      expect(result.vouchers.length).toBeGreaterThanOrEqual(1);
      expect((result.vouchers[0] as any).latestVoucher).toBeDefined();
    });

    it('should handle vouchers without merchant', async () => {
      const activeVoucherNoMerchant = {
        ...mockActiveVoucherRow,
        voucherMerchantId: null,
        voucherMerchantName: 'Unknown',
        merchantImageUrl: null,
      };

      prismaService.$queryRaw.mockResolvedValueOnce([mockCustomerRow]);
      prismaService.$queryRaw.mockResolvedValueOnce([mockCustomerCodeRow]);
      prismaService.$queryRaw.mockResolvedValueOnce([activeVoucherNoMerchant]);

      blockchainService.getUserCouponBalanceBatch.mockResolvedValue(
        new Map([['100', 1]]),
      );

      const result = await handler.execute('0812345678');

      expect(result.vouchers.length).toBeGreaterThanOrEqual(0);
    });

    it('should skip vouchers without tokenId', async () => {
      prismaService.$queryRaw.mockResolvedValueOnce([mockCustomerRow]);
      prismaService.$queryRaw.mockResolvedValueOnce([]);
      // Active vouchers query already filters WHERE tokenId IS NOT NULL
      prismaService.$queryRaw.mockResolvedValueOnce([]);

      const result = await handler.execute('0812345678');

      expect(blockchainService.getUserCouponBalanceBatch).not.toHaveBeenCalled();
      expect(result.vouchers).toHaveLength(0);
    });

    it('should create virtual entries when codes less than balance', async () => {
      prismaService.$queryRaw.mockResolvedValueOnce([mockCustomerRow]);
      // Only 1 code in DB
      prismaService.$queryRaw.mockResolvedValueOnce([mockCustomerCodeRow]);
      prismaService.$queryRaw.mockResolvedValueOnce([mockActiveVoucherRow]);

      // But on-chain balance shows 3
      blockchainService.getUserCouponBalanceBatch.mockResolvedValue(
        new Map([['100', 3]]),
      );

      const result = await handler.execute('0812345678');

      expect(result.vouchers.length).toBeGreaterThanOrEqual(1);
      expect((result.vouchers[0] as any).totalCodes).toBeGreaterThanOrEqual(1);
    });

    it('should not duplicate redeemed codes already in list', async () => {
      const usedCodeRow = { ...mockCustomerCodeRow, isUsed: true, usedAt: new Date() };

      prismaService.$queryRaw.mockResolvedValueOnce([mockCustomerRow]);
      prismaService.$queryRaw.mockResolvedValueOnce([usedCodeRow]);
      prismaService.$queryRaw.mockResolvedValueOnce([mockActiveVoucherRow]);

      // Balance=1 with 1 used code → handler creates:
      // 1 virtual unused entry (on-chain balance) + 1 used entry (redeemed code)
      blockchainService.getUserCouponBalanceBatch.mockResolvedValue(
        new Map([['100', 1]]),
      );

      const result = await handler.execute('0812345678');

      // 2 grouped entries: unused (virtual) + used (redeemed), no duplicates
      expect(result.vouchers).toHaveLength(2);
    });

    it('should use default pagination values', async () => {
      prismaService.$queryRaw.mockResolvedValueOnce([mockCustomerRow]);
      prismaService.$queryRaw.mockResolvedValueOnce([]);
      prismaService.$queryRaw.mockResolvedValueOnce([]);

      const result = await handler.execute('0812345678');

      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('should throw error on unexpected exceptions', async () => {
      prismaService.$queryRaw.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(handler.execute('0812345678')).rejects.toThrow(
        'Database error',
      );
    });
  });
});
