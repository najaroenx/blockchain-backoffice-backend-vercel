import { Test, TestingModule } from '@nestjs/testing';
import { VoucherDBService } from '../src/modules/voucher/services/voucher-db.service';
import { VoucherRepository } from '../src/modules/voucher/voucher.repository';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVoucherWithCodes } from '../src/modules/voucher/handlers/createVoucherWithCodes.handler';
import { ActivateVoucher } from '../src/modules/voucher/handlers/activateVoucher.handler';
import { RedeemVoucher } from '../src/modules/voucher/handlers/redeemVoucher.handler';
import { BuyCouponFromMarketplace } from '../src/modules/voucher/handlers/buyCouponFromMarketplace.handler';
import { GetCustomerOwnedVouchers } from '../src/modules/voucher/handlers/getCustomerOwnedVouchers.handler';
import { BlockchainService } from '../src/providers/blockchain/blockchain.service';
import { MockDataFactory, createMockPrismaClient } from './fixtures';

describe('VoucherDBService - Grouping Logic', () => {
  let service: VoucherDBService;
  let repository: any;
  let prisma: any;

  beforeEach(async () => {
    repository = {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    prisma = createMockPrismaClient();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VoucherDBService,
        {
          provide: VoucherRepository,
          useValue: repository,
        },
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: CreateVoucherWithCodes,
          useValue: { execute: jest.fn() },
        },
        {
          provide: ActivateVoucher,
          useValue: { execute: jest.fn() },
        },
        {
          provide: RedeemVoucher,
          useValue: { execute: jest.fn() },
        },
        {
          provide: BuyCouponFromMarketplace,
          useValue: { execute: jest.fn() },
        },
        {
          provide: GetCustomerOwnedVouchers,
          useValue: { execute: jest.fn() },
        },
        {
          provide: BlockchainService,
          useValue: {
            getUserCouponBalance: jest.fn(),
            createCouponType: jest.fn(),
            mintCoupon: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<VoucherDBService>(VoucherDBService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getVouchersByMerchant', () => {
    it('should group vouchers correctly with active, redeemed, and upcoming counts', async () => {
      const merchantId = 'merchant-123';
      const voucherId = 'voucher-123';

      const mockVoucherCode = {
        id: 'code-1',
        code: 'voucher-123-0001',
        voucherId,
        pointsCost: 100,
        pointId: 'point-123',
        currency: 'POINTS',
        createdAt: new Date(),
        voucherGroupId: 'listing-123',
        isUsed: false,
        currentOwnerId: null,
      };

      const mockVoucher = MockDataFactory.createMockVoucher({
        id: voucherId,
        merchantId,
        name: 'Test Voucher',
        status: 'upcoming',
        totalIssued: 50, // 50 upcoming vouchers not yet activated
        voucherCodes: [mockVoucherCode],
        merchant: MockDataFactory.createMockMerchant({
          id: merchantId,
          wallet: {
            walletAddress: '0x1234567890123456789012345678901234567890',
            privateKey: 'encrypted-0x1234',
          },
        }),
      });

      repository.findMany.mockResolvedValue([mockVoucher]);

      // Mock prisma.voucherCode.findMany for activatedCodes query
      prisma.voucherCode.findMany.mockResolvedValue([
        {
          voucherGroupId: 'listing-123',
          createdAt: new Date(),
          pointsCost: 100,
          pointId: 'point-123',
          currency: 'POINTS',
        },
      ]);

      // Mock counts for active and redeemed codes
      prisma.voucherCode.count
        .mockResolvedValueOnce(30) // active codes for this voucherGroupId (not used)
        .mockResolvedValueOnce(20); // redeemed codes for this voucherGroupId (used)

      const result = await service.getVouchersByMerchant(merchantId);

      expect(repository.findMany).toHaveBeenCalledWith({
        where: { merchantId },
        include: expect.objectContaining({
          merchant: true,
          voucherCodes: expect.any(Object),
        }),
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: voucherId,
        name: 'Test Voucher',
        activeCodesCount: 30,
        totalRedeemed: 20,
        upcomingCodesCount: 50,
        totalCodes: 100, // 30 active + 20 redeemed + 50 upcoming
      });
    });

    it('should handle vouchers with no codes yet', async () => {
      const merchantId = 'merchant-123';
      const mockVoucher = MockDataFactory.createMockVoucher({
        id: 'voucher-new',
        merchantId,
        totalIssued: 100,
        voucherCodes: [],
        merchant: MockDataFactory.createMockMerchant({
          id: merchantId,
          wallet: {
            walletAddress: '0x1234567890123456789012345678901234567890',
            privateKey: 'encrypted-0x1234',
          },
        }),
      });

      repository.findMany.mockResolvedValue([mockVoucher]);

      // Mock prisma.voucherCode.findMany for activatedCodes query (no activated codes yet)
      prisma.voucherCode.findMany.mockResolvedValue([]);

      prisma.voucherCode.count
        .mockResolvedValueOnce(0) // no active codes
        .mockResolvedValueOnce(0); // no redeemed codes

      const result = await service.getVouchersByMerchant(merchantId);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        activeCodesCount: 0,
        totalRedeemed: 0,
        upcomingCodesCount: 100,
        totalCodes: 100, // All upcoming
      });
    });

    it('should handle multiple vouchers with different statuses', async () => {
      const merchantId = 'merchant-123';

      const mockVoucherCode1 = {
        id: 'code-1',
        code: 'voucher-1-0001',
        voucherId: 'voucher-1',
        pointsCost: 50,
        pointId: 'point-123',
        currency: 'POINTS',
        createdAt: new Date('2025-01-01'),
        voucherGroupId: 'listing-1',
        isUsed: false,
        currentOwnerId: null,
      };

      const voucher1 = MockDataFactory.createMockVoucher({
        id: 'voucher-1',
        merchantId,
        name: 'Voucher 1',
        status: 'active',
        totalIssued: 10,
        voucherCodes: [mockVoucherCode1],
        merchant: MockDataFactory.createMockMerchant({
          id: merchantId,
          wallet: {
            walletAddress: '0x1234567890123456789012345678901234567890',
            privateKey: 'encrypted-0x1234',
          },
        }),
      });

      const voucher2 = MockDataFactory.createMockVoucher({
        id: 'voucher-2',
        merchantId,
        name: 'Voucher 2',
        status: 'upcoming',
        totalIssued: 200,
        voucherCodes: [],
        merchant: MockDataFactory.createMockMerchant({
          id: merchantId,
          wallet: {
            walletAddress: '0x1234567890123456789012345678901234567890',
            privateKey: 'encrypted-0x1234',
          },
        }),
      });

      repository.findMany.mockResolvedValue([voucher1, voucher2]);

      // Mock prisma.voucherCode.findMany for activatedCodes query
      // Will be called twice (once per voucher)
      prisma.voucherCode.findMany
        .mockResolvedValueOnce([
          {
            voucherGroupId: 'listing-1',
            createdAt: new Date('2025-01-01'),
            pointsCost: 50,
            pointId: 'point-123',
            currency: 'POINTS',
          },
        ]) // voucher1 has activated codes
        .mockResolvedValueOnce([]); // voucher2 has no activated codes

      // Mock counts for voucher1
      prisma.voucherCode.count
        .mockResolvedValueOnce(40) // voucher1 active
        .mockResolvedValueOnce(10) // voucher1 redeemed
        // Mock counts for voucher2
        .mockResolvedValueOnce(0) // voucher2 active
        .mockResolvedValueOnce(0); // voucher2 redeemed

      const result = await service.getVouchersByMerchant(merchantId);

      expect(result).toHaveLength(2);

      // Voucher 1 - active status
      expect(result[0]).toMatchObject({
        id: 'voucher-1',
        name: 'Voucher 1',
        status: 'active',
        activeCodesCount: 40,
        totalRedeemed: 10,
        upcomingCodesCount: 10,
        totalCodes: 60,
      });

      // Voucher 2 - upcoming status
      expect(result[1]).toMatchObject({
        id: 'voucher-2',
        name: 'Voucher 2',
        status: 'upcoming',
        activeCodesCount: 0,
        totalRedeemed: 0,
        upcomingCodesCount: 200,
        totalCodes: 200,
      });
    });

    it('should return empty array when merchant has no vouchers', async () => {
      const merchantId = 'merchant-no-vouchers';

      repository.findMany.mockResolvedValue([]);

      const result = await service.getVouchersByMerchant(merchantId);

      expect(result).toEqual([]);
    });
  });

  describe('getVoucherById', () => {
    it('should return voucher with correct counts', async () => {
      const voucherId = 'voucher-123';

      const mockVoucherCode = {
        id: 'code-1',
        code: 'voucher-123-0001',
        voucherId,
        pointsCost: 100,
        pointId: 'point-123',
        currency: 'POINTS',
        voucherGroupId: 'listing-123',
        isUsed: false,
        currentOwnerId: null,
      };

      const mockVoucher = MockDataFactory.createMockVoucher({
        id: voucherId,
        name: 'Test Voucher',
        totalIssued: 50,
        voucherCodes: [mockVoucherCode],
      });

      repository.findUnique.mockResolvedValue(mockVoucher);

      // Mock prisma.voucherCode.findMany for activatedCodes query
      prisma.voucherCode.findMany.mockResolvedValue([
        {
          voucherGroupId: 'listing-123',
          createdAt: new Date(),
          pointsCost: 100,
          pointId: 'point-123',
          currency: 'POINTS',
        },
      ]);

      prisma.voucherCode.count
        .mockResolvedValueOnce(30) // active codes
        .mockResolvedValueOnce(15); // redeemed codes

      const result = await service.getVoucherById(voucherId);

      expect(repository.findUnique).toHaveBeenCalledWith({
        where: { id: voucherId },
        include: expect.any(Object),
      });

      expect(result).toMatchObject({
        id: voucherId,
        pointsCost: 100,
        activeCodesCount: 30,
        totalRedeemed: 15,
        upcomingCodesCount: 50,
        totalCodes: 95, // 30 + 15 + 50
      });
    });

    it('should handle voucher with no codes', async () => {
      const voucherId = 'voucher-new';

      const mockVoucher = MockDataFactory.createMockVoucher({
        id: voucherId,
        totalIssued: 100,
        voucherCodes: [],
      });

      repository.findUnique.mockResolvedValue(mockVoucher);

      // Mock prisma.voucherCode.findMany for activatedCodes query (no activated codes)
      prisma.voucherCode.findMany.mockResolvedValue([]);

      prisma.voucherCode.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      const result = await service.getVoucherById(voucherId);

      expect(result).toMatchObject({
        pointsCost: 0, // No codes yet
        activeCodesCount: 0,
        totalRedeemed: 0,
        upcomingCodesCount: 100,
        totalCodes: 100,
      });
    });
  });

  describe('getAllVouchers', () => {
    it('should return all vouchers', async () => {
      const mockVouchers = [
        MockDataFactory.createMockVoucher({ id: 'voucher-1', name: 'V1' }),
        MockDataFactory.createMockVoucher({ id: 'voucher-2', name: 'V2' }),
        MockDataFactory.createMockVoucher({ id: 'voucher-3', name: 'V3' }),
      ];

      repository.findMany.mockResolvedValue(mockVouchers);

      const result = await service.getAllVouchers();

      expect(repository.findMany).toHaveBeenCalledWith({
        include: expect.any(Object),
      });
      expect(result).toHaveLength(3);
      expect(result[0].id).toBe('voucher-1');
      expect(result[1].id).toBe('voucher-2');
      expect(result[2].id).toBe('voucher-3');
    });

    it('should return empty array when no vouchers exist', async () => {
      repository.findMany.mockResolvedValue([]);

      const result = await service.getAllVouchers();

      expect(result).toEqual([]);
    });
  });

  describe('getActiveVouchers', () => {
    it('should return only active vouchers', async () => {
      // Mock prisma.voucherCode.findMany for active codes query
      prisma.voucherCode.findMany.mockResolvedValue([
        { voucherId: 'voucher-1' },
        { voucherId: 'voucher-2' },
      ]);

      // Mock prisma.voucher.findMany for vouchers query
      const mockActiveVouchers = [
        MockDataFactory.createMockVoucher({
          id: 'voucher-1',
          status: 'active',
          merchant: MockDataFactory.createMockMerchant(),
          voucherCodes: [{ pointsCost: 100 }],
        }),
        MockDataFactory.createMockVoucher({
          id: 'voucher-2',
          status: 'active',
          merchant: MockDataFactory.createMockMerchant(),
          voucherCodes: [{ pointsCost: 200 }],
        }),
      ];

      prisma.voucher.findMany.mockResolvedValue(mockActiveVouchers);

      const result = await service.getActiveVouchers();

      expect(prisma.voucherCode.findMany).toHaveBeenCalledWith({
        where: {
          voucherGroupId: { not: null },
          isUsed: false,
        },
        select: {
          voucherId: true,
        },
        distinct: ['voucherId'],
      });
      expect(result).toHaveLength(2);
    });
  });
});
