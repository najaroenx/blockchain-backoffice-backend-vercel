jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import { GetCustomerOwnedVouchers } from 'src/modules/internal/voucher/handlers/getCustomerOwnedVouchers.handler';
import { PrismaService } from 'prisma/prisma.service';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';
import { MerchantRefEnrichmentService } from 'src/modules/shared/services/merchant-ref-enrichment.service';

describe('GetCustomerOwnedVouchers', () => {
  let handler: GetCustomerOwnedVouchers;
  let prisma: any;
  let blockchainService: any;
  let merchantRefEnrichment: any;

  beforeEach(() => {
    prisma = {
      $queryRaw: jest.fn(),
    };
    blockchainService = {
      getUserCouponBalanceBatch: jest.fn(),
      getUserCouponBalance: jest.fn(),
    };
    merchantRefEnrichment = {
      enrichBatch: jest.fn(),
    };

    handler = new GetCustomerOwnedVouchers(
      prisma as unknown as PrismaService,
      blockchainService as unknown as BlockchainService,
      merchantRefEnrichment as unknown as MerchantRefEnrichmentService,
    );
  });

  it('should return empty when customer not found', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]);

    const result = await handler.execute('0891234567');

    expect(result.total).toBe(0);
    expect(result.vouchers).toEqual([]);
    expect(result.summary).toEqual({ total: 0, unused: 0, used: 0 });
  });

  it('should return vouchers with on-chain balances', async () => {
    // STEP 1: Customer query
    prisma.$queryRaw.mockResolvedValueOnce([
      { id: 'cust1', tel: '0891234567', walletAddress: '0xwallet' },
    ]);

    // STEP 2: Customer codes
    prisma.$queryRaw.mockResolvedValueOnce([
      {
        codeId: 'code1',
        code: 'ABC123',
        voucherGroupId: 'grp1',
        pointsCost: 10,
        currency: 'PT',
        isUsed: false,
        usedAt: null,
        codeCreatedAt: new Date(),
        voucherId: 'v1',
        voucherName: 'V1',
        voucherDescription: 'Desc',
        voucherImageUrl: null,
        voucherValue: 100,
        voucherValueType: 'cash',
        voucherStatus: 'active',
        voucherStartDate: new Date('2025-01-01'),
        voucherEndDate: new Date('2025-12-31'),
        voucherMerchantRef: null,
        voucherMerchantId: 'm1',
        voucherMerchantName: 'Merchant1',
        voucherTokenId: '1',
        merchantImageUrl: null,
        merchantDbName: 'Merchant1',
        txId: 'tx1',
        txTransactionTypeId: 'TRANSFER',
      },
    ]);

    // STEP 3: Active vouchers
    prisma.$queryRaw.mockResolvedValueOnce([
      {
        voucherId: 'v1',
        tokenId: '1',
        voucherName: 'V1',
        voucherDescription: 'Desc',
        voucherImageUrl: null,
        voucherValue: 100,
        voucherValueType: 'cash',
        voucherStatus: 'active',
        voucherStartDate: new Date('2025-01-01'),
        voucherEndDate: new Date('2025-12-31'),
        voucherMerchantRef: null,
        voucherMerchantId: 'm1',
        voucherMerchantName: 'Merchant1',
        merchantImageUrl: null,
        samplePointsCost: 10,
        sampleCurrency: 'PT',
      },
    ]);

    // STEP 4: On-chain balance
    const balanceMap = new Map();
    balanceMap.set('1', 1);
    blockchainService.getUserCouponBalanceBatch.mockResolvedValue(balanceMap);

    const result = await handler.execute('0891234567');

    expect(result.total).toBeGreaterThan(0);
    expect(result.vouchers).toBeDefined();
  });

  it('should handle status filter: used', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([
        { id: 'cust1', tel: '0891234567', walletAddress: '0xwallet' },
      ])
      .mockResolvedValueOnce([
        {
          codeId: 'code1',
          code: 'ABC123',
          voucherGroupId: 'grp1',
          pointsCost: 10,
          currency: 'PT',
          isUsed: true,
          usedAt: new Date(),
          codeCreatedAt: new Date(),
          voucherId: 'v1',
          voucherName: 'V1',
          voucherDescription: 'Desc',
          voucherImageUrl: null,
          voucherValue: 100,
          voucherValueType: 'cash',
          voucherStatus: 'active',
          voucherStartDate: new Date('2025-01-01'),
          voucherEndDate: new Date('2025-12-31'),
          voucherMerchantRef: null,
          voucherMerchantId: 'm1',
          voucherMerchantName: 'Merchant1',
          voucherTokenId: '1',
          merchantImageUrl: null,
          merchantDbName: 'M1',
          txId: 'tx1',
          txTransactionTypeId: 'REDEEM',
        },
      ])
      .mockResolvedValueOnce([]); // no active vouchers

    blockchainService.getUserCouponBalanceBatch.mockResolvedValue(new Map());

    const result = await handler.execute('0891234567', 'used');

    expect(result.status).toBe('used');
  });

  it('should fallback to individual balance calls on batch failure', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([
        { id: 'cust1', tel: '089', walletAddress: '0xw' },
      ])
      .mockResolvedValueOnce([]) // no customer codes
      .mockResolvedValueOnce([
        {
          voucherId: 'v1',
          tokenId: '1',
          voucherName: 'V1',
          voucherDescription: 'D',
          voucherImageUrl: null,
          voucherValue: 10,
          voucherValueType: 'cash',
          voucherStatus: 'active',
          voucherStartDate: new Date(),
          voucherEndDate: new Date('2030-01-01'),
          voucherMerchantRef: null,
          voucherMerchantId: 'm1',
          voucherMerchantName: 'M',
          merchantImageUrl: null,
          samplePointsCost: 5,
          sampleCurrency: 'PT',
        },
      ]);

    blockchainService.getUserCouponBalanceBatch.mockRejectedValue(
      new Error('batch fail'),
    );
    blockchainService.getUserCouponBalance.mockResolvedValue({ balance: '2' });

    const result = await handler.execute('089');

    // Should have called individual balance
    expect(blockchainService.getUserCouponBalance).toHaveBeenCalled();
  });

  it('should enrich merchantRef details', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([
        { id: 'cust1', tel: '089', walletAddress: '0xw' },
      ])
      .mockResolvedValueOnce([
        {
          codeId: 'c1',
          code: 'X',
          voucherGroupId: 'g1',
          pointsCost: 10,
          currency: 'PT',
          isUsed: false,
          usedAt: null,
          codeCreatedAt: new Date(),
          voucherId: 'v1',
          voucherName: 'V1',
          voucherDescription: 'D',
          voucherImageUrl: null,
          voucherValue: 50,
          voucherValueType: 'cash',
          voucherStatus: 'active',
          voucherStartDate: new Date('2025-01-01'),
          voucherEndDate: new Date('2025-12-31'),
          voucherMerchantRef: 'ref1',
          voucherMerchantId: 'm1',
          voucherMerchantName: 'M1',
          voucherTokenId: '1',
          merchantImageUrl: null,
          merchantDbName: 'M1',
          txId: null,
          txTransactionTypeId: null,
        },
      ])
      .mockResolvedValueOnce([
        {
          voucherId: 'v1',
          tokenId: '1',
          voucherName: 'V1',
          voucherDescription: 'D',
          voucherImageUrl: null,
          voucherValue: 50,
          voucherValueType: 'cash',
          voucherStatus: 'active',
          voucherStartDate: new Date('2025-01-01'),
          voucherEndDate: new Date('2025-12-31'),
          voucherMerchantRef: 'ref1',
          voucherMerchantId: 'm1',
          voucherMerchantName: 'M1',
          merchantImageUrl: null,
          samplePointsCost: 10,
          sampleCurrency: 'PT',
        },
      ]);

    const bMap = new Map();
    bMap.set('1', 1);
    blockchainService.getUserCouponBalanceBatch.mockResolvedValue(bMap);

    const refMap = new Map();
    refMap.set('ref1', {
      id: 'mrs1',
      merchantRef: 'ref1',
      name: 'Store',
      category: 'food',
      description: 'desc',
      imageUrl: null,
      locationUrl: null,
      website: null,
      isActive: true,
    });
    merchantRefEnrichment.enrichBatch.mockResolvedValue(refMap);

    const result = await handler.execute('089');

    expect(merchantRefEnrichment.enrichBatch).toHaveBeenCalled();
  });

  it('should re-throw error from execute', async () => {
    prisma.$queryRaw.mockRejectedValueOnce(new Error('fatal'));

    await expect(handler.execute('089')).rejects.toThrow('fatal');
  });
});
