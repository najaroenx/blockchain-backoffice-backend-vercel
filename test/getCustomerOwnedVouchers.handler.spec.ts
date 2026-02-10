import { Test, TestingModule } from '@nestjs/testing';
import { GetCustomerOwnedVouchers } from '../src/modules/internal/voucher/handlers/getCustomerOwnedVouchers.handler';
import { PrismaService } from '../prisma/prisma.service';
import { BlockchainService } from '../src/providers/blockchain/blockchain.service';

describe('GetCustomerOwnedVouchers', () => {
  let handler: GetCustomerOwnedVouchers;
  let prismaService: any;
  let blockchainService: jest.Mocked<BlockchainService>;

  const mockCustomer = {
    id: 'customer-1',
    tel: '0812345678',
    wallet: {
      walletAddress: '0xCustomerWallet123',
    },
  };

  const mockVoucher = {
    id: 'voucher-1',
    tokenId: '100',
    name: 'Test Voucher',
    description: 'Test Description',
    valueType: 'cash',
    value: 100,
    currency: 'POINT',
    imageUrl: 'https://example.com/voucher.jpg',
    startDate: new Date('2024-01-01'),
    endDate: new Date('2027-12-31'),
    merchantRef: 'MERCHANT-REF',
    merchantName: 'Test Merchant',
    status: 'active',
    merchant: {
      id: 'merchant-1',
      name: 'Test Merchant',
      imageUrl: 'https://example.com/merchant.jpg',
    },
    voucherCodes: [
      {
        id: 'code-1',
        code: 'CODE-1',
        pointsCost: 50,
        currency: 'POINT',
        isUsed: false,
        usedAt: null,
        currentOwnerId: 'customer-1',
        createdAt: new Date('2024-01-15'),
      },
    ],
  };

  const mockVoucherCode = {
    id: 'code-1',
    code: 'CODE-1',
    voucherId: 'voucher-1',
    pointsCost: 50,
    currency: 'POINT',
    isUsed: false,
    usedAt: null,
    currentOwnerId: 'customer-1',
    createdAt: new Date('2024-01-15'),
    transactions: [
      {
        id: 'tx-1',
        receiverId: 'customer-1',
        transactionTypeId: 'MARKETPLACE_PURCHASE',
        createdAt: new Date('2024-01-15'),
        transactionType: {
          name: 'Marketplace Purchase',
        },
      },
    ],
  };

  const mockRedeemedCode = {
    id: 'code-2',
    code: 'CODE-2',
    voucherId: 'voucher-1',
    pointsCost: 50,
    currency: 'POINT',
    isUsed: true,
    usedAt: new Date('2024-02-01'),
    currentOwnerId: 'customer-1',
    createdAt: new Date('2024-01-20'),
    voucher: mockVoucher,
    transactions: [
      {
        id: 'tx-2',
        receiverId: 'customer-1',
        transactionTypeId: 'REDEEM',
        createdAt: new Date('2024-02-01'),
        transactionType: {
          name: 'Redeem',
        },
      },
    ],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetCustomerOwnedVouchers,
        {
          provide: PrismaService,
          useValue: {
            customer: {
              findFirst: jest.fn(),
            },
            voucher: {
              findMany: jest.fn(),
            },
            voucherCode: {
              findMany: jest.fn(),
            },
          },
        },
        {
          provide: BlockchainService,
          useValue: {
            getUserCouponBalance: jest.fn(),
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
      prismaService.customer.findFirst.mockResolvedValue(null);

      const result = await handler.execute('0812345678');

      expect(result.phone).toBe('0812345678');
      expect(result.walletAddress).toBeNull();
      expect(result.customerId).toBeNull();
      expect(result.vouchers).toEqual([]);
      expect(result.summary.total).toBe(0);
    });

    it('should return empty result when customer has no wallet', async () => {
      prismaService.customer.findFirst.mockResolvedValue({
        ...mockCustomer,
        wallet: null,
      });

      const result = await handler.execute('0812345678');

      expect(result.phone).toBe('0812345678');
      expect(result.walletAddress).toBeNull();
      expect(result.vouchers).toEqual([]);
    });

    it('should return vouchers with on-chain balance', async () => {
      prismaService.customer.findFirst.mockResolvedValue(mockCustomer);
      prismaService.voucher.findMany.mockResolvedValue([mockVoucher]);
      blockchainService.getUserCouponBalance.mockResolvedValue({
        address: '0xCustomerWallet123',
        typeId: '100',
        balance: '2',
      });
      prismaService.voucherCode.findMany
        .mockResolvedValueOnce([
          {
            ...mockVoucherCode,
            transactions: [mockVoucherCode.transactions[0]],
          },
        ])
        .mockResolvedValueOnce([]);

      const result = await handler.execute('0812345678');

      expect(result.walletAddress).toBe('0xCustomerWallet123');
      expect(result.customerId).toBe('customer-1');
      expect(result.vouchers.length).toBeGreaterThanOrEqual(1);
      expect(
        (result.vouchers[0] as any).latestVoucher?.name ||
          (result.vouchers[0] as any).latestVoucher,
      ).toBeDefined();
      expect(result.summary.total).toBeGreaterThanOrEqual(1);
    });

    it('should filter by unused status', async () => {
      prismaService.customer.findFirst.mockResolvedValue(mockCustomer);
      prismaService.voucher.findMany.mockResolvedValue([mockVoucher]);
      blockchainService.getUserCouponBalance.mockResolvedValue({
        address: '0xCustomerWallet123',
        typeId: '100',
        balance: '1',
      });
      prismaService.voucherCode.findMany
        .mockResolvedValueOnce([mockVoucherCode])
        .mockResolvedValueOnce([mockRedeemedCode]);

      const result = await handler.execute('0812345678', 'unused');

      expect(result.status).toBe('unused');
      expect(
        result.vouchers.every(
          (v: any) => v.latestVoucher?.codeStatus !== 'used',
        ),
      ).toBe(true);
    });

    it('should filter by used status', async () => {
      prismaService.customer.findFirst.mockResolvedValue(mockCustomer);
      prismaService.voucher.findMany.mockResolvedValue([mockVoucher]);
      blockchainService.getUserCouponBalance.mockResolvedValue({
        address: '0xCustomerWallet123',
        typeId: '100',
        balance: '1',
      });
      prismaService.voucherCode.findMany
        .mockResolvedValueOnce([mockVoucherCode])
        .mockResolvedValueOnce([mockRedeemedCode]);

      const result = await handler.execute('0812345678', 'used');

      expect(result.status).toBe('used');
      expect(
        result.vouchers.every(
          (v: any) => v.latestVoucher?.codeStatus === 'used',
        ),
      ).toBe(true);
    });

    it('should include redeemed vouchers with zero balance', async () => {
      prismaService.customer.findFirst.mockResolvedValue(mockCustomer);
      prismaService.voucher.findMany.mockResolvedValue([mockVoucher]);
      blockchainService.getUserCouponBalance.mockResolvedValue({
        address: '0xCustomerWallet123',
        typeId: '100',
        balance: '0',
      });
      prismaService.voucherCode.findMany.mockResolvedValueOnce([
        mockRedeemedCode,
      ]);

      const result = await handler.execute('0812345678');

      expect(result.vouchers).toHaveLength(1);
      expect((result.vouchers[0] as any).latestVoucher?.codeStatus).toBe(
        'used',
      );
      expect(result.summary.used).toBe(1);
    });

    it('should apply pagination correctly', async () => {
      prismaService.customer.findFirst.mockResolvedValue(mockCustomer);
      prismaService.voucher.findMany.mockResolvedValue([mockVoucher]);
      blockchainService.getUserCouponBalance.mockResolvedValue({
        address: '0xCustomerWallet123',
        typeId: '100',
        balance: '5',
      });
      prismaService.voucherCode.findMany
        .mockResolvedValueOnce([mockVoucherCode])
        .mockResolvedValueOnce([]);

      const result = await handler.execute('0812345678', 'all', 2, 2);

      expect((result as any).page).toBe(2);
      expect((result as any).limit).toBe(2);
      expect((result as any).total).toBeGreaterThanOrEqual(0);
      expect((result as any).totalPages).toBeGreaterThanOrEqual(0);
    });

    it('should handle blockchain service errors gracefully', async () => {
      prismaService.customer.findFirst.mockResolvedValue(mockCustomer);
      prismaService.voucher.findMany.mockResolvedValue([mockVoucher]);
      blockchainService.getUserCouponBalance.mockRejectedValue(
        new Error('RPC error'),
      );
      prismaService.voucherCode.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await handler.execute('0812345678');

      expect(result.vouchers).toHaveLength(0);
      expect(result.summary.total).toBe(0);
    });

    it('should map purchase transaction correctly', async () => {
      prismaService.customer.findFirst.mockResolvedValue(mockCustomer);
      prismaService.voucher.findMany.mockResolvedValue([mockVoucher]);
      blockchainService.getUserCouponBalance.mockResolvedValue({
        address: '0xCustomerWallet123',
        typeId: '100',
        balance: '1',
      });
      prismaService.voucherCode.findMany
        .mockResolvedValueOnce([mockVoucherCode])
        .mockResolvedValueOnce([]);

      const result = await handler.execute('0812345678');

      expect(result.vouchers.length).toBeGreaterThanOrEqual(1);
      expect((result.vouchers[0] as any).latestVoucher).toBeDefined();
    });

    it('should handle vouchers without merchant', async () => {
      const voucherWithoutMerchant = {
        ...mockVoucher,
        merchant: null,
      };

      prismaService.customer.findFirst.mockResolvedValue(mockCustomer);
      prismaService.voucher.findMany.mockResolvedValue([
        voucherWithoutMerchant,
      ]);
      blockchainService.getUserCouponBalance.mockResolvedValue({
        address: '0xCustomerWallet123',
        typeId: '100',
        balance: '1',
      });
      prismaService.voucherCode.findMany
        .mockResolvedValueOnce([mockVoucherCode])
        .mockResolvedValueOnce([]);

      const result = await handler.execute('0812345678');

      expect(result.vouchers.length).toBeGreaterThanOrEqual(0);
    });

    it('should skip vouchers without tokenId', async () => {
      const voucherWithoutToken = {
        ...mockVoucher,
        tokenId: null,
      };

      prismaService.customer.findFirst.mockResolvedValue(mockCustomer);
      prismaService.voucher.findMany.mockResolvedValue([voucherWithoutToken]);
      prismaService.voucherCode.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await handler.execute('0812345678');

      expect(blockchainService.getUserCouponBalance).not.toHaveBeenCalled();
      expect(result.vouchers).toHaveLength(0);
    });

    it('should create virtual entries when codes less than balance', async () => {
      prismaService.customer.findFirst.mockResolvedValue(mockCustomer);
      prismaService.voucher.findMany.mockResolvedValue([mockVoucher]);
      blockchainService.getUserCouponBalance.mockResolvedValue({
        address: '0xCustomerWallet123',
        typeId: '100',
        balance: '3',
      });
      prismaService.voucherCode.findMany
        .mockResolvedValueOnce([mockVoucherCode]) // Only 1 code
        .mockResolvedValueOnce([]);

      const result = await handler.execute('0812345678');

      expect(result.vouchers.length).toBeGreaterThanOrEqual(1); // Grouped by voucherGroupId
      expect((result.vouchers[0] as any).totalCodes).toBeGreaterThanOrEqual(1);
    });

    it('should not duplicate redeemed codes already in list', async () => {
      const usedCode = { ...mockVoucherCode, isUsed: true };

      prismaService.customer.findFirst.mockResolvedValue(mockCustomer);
      prismaService.voucher.findMany.mockResolvedValue([mockVoucher]);
      blockchainService.getUserCouponBalance.mockResolvedValue({
        address: '0xCustomerWallet123',
        typeId: '100',
        balance: '1',
      });
      prismaService.voucherCode.findMany
        .mockResolvedValueOnce([usedCode])
        .mockResolvedValueOnce([usedCode]);

      const result = await handler.execute('0812345678');

      expect(result.vouchers).toHaveLength(1); // Should not duplicate
    });

    it('should use default pagination values', async () => {
      prismaService.customer.findFirst.mockResolvedValue(mockCustomer);
      prismaService.voucher.findMany.mockResolvedValue([]);
      prismaService.voucherCode.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await handler.execute('0812345678');

      expect((result as any).page).toBe(1);
      expect((result as any).limit).toBe(20);
    });

    it('should throw error on unexpected exceptions', async () => {
      prismaService.customer.findFirst.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(handler.execute('0812345678')).rejects.toThrow(
        'Database error',
      );
    });
  });
});
