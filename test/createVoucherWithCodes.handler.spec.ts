import { Test, TestingModule } from '@nestjs/testing';
import { CreateVoucherWithCodes } from '../src/modules/internal/voucher/handlers/createVoucherWithCodes.handler';
import { PrismaService } from '../prisma/prisma.service';
import { BlockchainService } from '../src/providers/blockchain/blockchain.service';
import {
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { CreateVoucherDto } from '../src/modules/internal/voucher/dtos/voucher.dto';
import { VoucherValueType } from '@prisma/client';

describe('CreateVoucherWithCodes', () => {
  let handler: CreateVoucherWithCodes;
  let prismaService: any;
  let blockchainService: jest.Mocked<BlockchainService>;

  const mockPoint = {
    id: 'point-1',
    symbol: 'REWARD',
    merchantId: 'merchant-1',
    name: 'Reward Points',
  };

  const mockMerchant = {
    name: 'Test Merchant',
  };

  const mockVoucher = {
    id: 'COUPON-123',
    name: 'Test Voucher',
    description: 'Test voucher description',
    value: 100,
    valueType: VoucherValueType.cash,
    totalIssued: 50,
    totalRedeemed: 0,
    status: 'active',
    merchantId: 'merchant-1',
    merchantName: 'Test Merchant',
    merchantRef: 'TEST-REF',
    currency: 'REWARD',
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-12-31'),
    tokenId: '12345',
    imageUrl: 'https://example.com/voucher.png',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockBlockchainResult = {
    typeId: '12345',
    hash: '0xabc123',
    blockNumber: 100,
  };

  beforeEach(async () => {
    const mockPrismaService = {
      point: {
        findUnique: jest.fn(),
      },
      merchant: {
        findUnique: jest.fn(),
      },
      voucher: {
        create: jest.fn(),
      },
      voucherCode: {
        findMany: jest.fn(),
      },
      $transaction: jest.fn(),
    } as any;

    const mockBlockchainService = {
      createCouponType: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateVoucherWithCodes,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: BlockchainService,
          useValue: mockBlockchainService,
        },
      ],
    }).compile();

    handler = module.get<CreateVoucherWithCodes>(CreateVoucherWithCodes);
    prismaService = module.get(PrismaService);
    blockchainService = module.get(BlockchainService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    const createVoucherDto: CreateVoucherDto = {
      name: 'Test Voucher',
      description: 'Test voucher description',
      value: 100,
      valueType: VoucherValueType.cash,
      status: 'active',
      totalIssued: 50,
      merchantId: 'merchant-1',
      pointId: 'point-1',
      pointsCost: 10,
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      merchantRef: 'TEST-REF',
      imageUrl: 'https://example.com/voucher.png',
    };

    it('should successfully create voucher with point validation', async () => {
      prismaService.point.findUnique.mockResolvedValue(mockPoint);
      prismaService.merchant.findUnique.mockResolvedValue(mockMerchant);
      blockchainService.createCouponType.mockResolvedValue(
        mockBlockchainResult,
      );

      prismaService.$transaction.mockImplementation(async (callback: any) => {
        return await callback({
          voucher: {
            create: jest.fn().mockResolvedValue(mockVoucher),
          },
        });
      });

      const result = await handler.execute(createVoucherDto);

      expect(result.success).toBe(true);
      expect(result.voucher).toBeDefined();
      expect(result.pointsCost).toBe(10);
      expect(result.pointId).toBe('point-1');
      expect(result.pointSymbol).toBe('REWARD');
      expect(result.message).toContain('Voucher created successfully');
      expect(result.note).toBe(
        'Voucher codes will be created when activating the voucher',
      );

      expect(prismaService.point.findUnique).toHaveBeenCalledWith({
        where: { id: 'point-1' },
        select: { id: true, symbol: true, merchantId: true, name: true },
      });
      expect(prismaService.merchant.findUnique).toHaveBeenCalledWith({
        where: { id: 'merchant-1' },
        select: { name: true },
      });
      expect(blockchainService.createCouponType).toHaveBeenCalled();
    });

    it('should create voucher without pointId', async () => {
      const dtoWithoutPoint = { ...createVoucherDto };
      delete dtoWithoutPoint.pointId;

      prismaService.merchant.findUnique.mockResolvedValue(mockMerchant);
      blockchainService.createCouponType.mockResolvedValue(
        mockBlockchainResult,
      );

      prismaService.$transaction.mockImplementation(async (callback: any) => {
        return await callback({
          voucher: {
            create: jest.fn().mockResolvedValue({
              ...mockVoucher,
              currency: null,
            }),
          },
        });
      });

      const result = await handler.execute(dtoWithoutPoint);

      expect(result.success).toBe(true);
      expect(result.pointSymbol).toBeNull();
      expect(result.message).toContain(
        'Merchant will set point currency during activation',
      );
      expect(prismaService.point.findUnique).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when point not found', async () => {
      prismaService.point.findUnique.mockResolvedValue(null);
      prismaService.merchant.findUnique.mockResolvedValue(mockMerchant);
      blockchainService.createCouponType.mockResolvedValue(
        mockBlockchainResult,
      );

      await expect(handler.execute(createVoucherDto)).rejects.toThrow(
        new ConflictException(
          `Point with ID ${createVoucherDto.pointId} not found`,
        ),
      );

      expect(prismaService.point.findUnique).toHaveBeenCalledWith({
        where: { id: 'point-1' },
        select: { id: true, symbol: true, merchantId: true, name: true },
      });
    });

    it('should throw ConflictException when point belongs to different merchant', async () => {
      const differentMerchantPoint = {
        ...mockPoint,
        merchantId: 'different-merchant',
      };
      prismaService.point.findUnique.mockResolvedValue(differentMerchantPoint);
      prismaService.merchant.findUnique.mockResolvedValue(mockMerchant);
      blockchainService.createCouponType.mockResolvedValue(
        mockBlockchainResult,
      );

      await expect(handler.execute(createVoucherDto)).rejects.toThrow(
        new ConflictException('Point does not belong to this merchant'),
      );
    });

    it('should handle merchant not found gracefully', async () => {
      prismaService.point.findUnique.mockResolvedValue(mockPoint);
      prismaService.merchant.findUnique.mockResolvedValue(null);
      blockchainService.createCouponType.mockResolvedValue(
        mockBlockchainResult,
      );

      prismaService.$transaction.mockImplementation(async (callback: any) => {
        return await callback({
          voucher: {
            create: jest.fn().mockResolvedValue({
              ...mockVoucher,
              merchantName: 'Unknown',
            }),
          },
        });
      });

      const result = await handler.execute(createVoucherDto);

      expect(result.success).toBe(true);
      expect(prismaService.merchant.findUnique).toHaveBeenCalled();
    });

    it('should throw ConflictException for duplicate coupon ID', async () => {
      prismaService.point.findUnique.mockResolvedValue(mockPoint);
      prismaService.merchant.findUnique.mockResolvedValue(mockMerchant);
      blockchainService.createCouponType.mockResolvedValue(
        mockBlockchainResult,
      );

      const duplicateError: any = new Error('Unique constraint failed');
      duplicateError.code = 'P2002';
      duplicateError.meta = { target: ['id'] };

      prismaService.$transaction.mockRejectedValue(duplicateError);

      await expect(handler.execute(createVoucherDto)).rejects.toThrow(
        new ConflictException('Duplicate coupon ID'),
      );
    });

    it('should throw InternalServerErrorException for general errors', async () => {
      prismaService.point.findUnique.mockResolvedValue(mockPoint);
      prismaService.merchant.findUnique.mockResolvedValue(mockMerchant);
      blockchainService.createCouponType.mockResolvedValue(
        mockBlockchainResult,
      );

      prismaService.$transaction.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(handler.execute(createVoucherDto)).rejects.toThrow(
        new InternalServerErrorException('Failed to create voucher'),
      );
    });

    it('should handle blockchain service failure', async () => {
      prismaService.point.findUnique.mockResolvedValue(mockPoint);
      prismaService.merchant.findUnique.mockResolvedValue(mockMerchant);
      blockchainService.createCouponType.mockRejectedValue(
        new Error('Blockchain connection failed'),
      );

      prismaService.$transaction.mockImplementation(async (callback: any) => {
        return await callback({
          voucher: {
            create: jest.fn(),
          },
        });
      });

      await expect(handler.execute(createVoucherDto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should convert date strings to timestamps for blockchain', async () => {
      prismaService.point.findUnique.mockResolvedValue(mockPoint);
      prismaService.merchant.findUnique.mockResolvedValue(mockMerchant);
      blockchainService.createCouponType.mockResolvedValue(
        mockBlockchainResult,
      );

      prismaService.$transaction.mockImplementation(async (callback: any) => {
        return await callback({
          voucher: {
            create: jest.fn().mockResolvedValue(mockVoucher),
          },
        });
      });

      await handler.execute(createVoucherDto);

      expect(blockchainService.createCouponType).toHaveBeenCalledWith(
        'Test Voucher',
        expect.any(Number), // startTimestamp
        expect.any(Number), // endTimestamp
      );

      const [, startTimestamp, endTimestamp] =
        blockchainService.createCouponType.mock.calls[0];
      expect(startTimestamp).toBeGreaterThan(0);
      expect(endTimestamp).toBeGreaterThan(startTimestamp);
    });

    it('should pass correct transaction timeout', async () => {
      prismaService.point.findUnique.mockResolvedValue(mockPoint);
      prismaService.merchant.findUnique.mockResolvedValue(mockMerchant);
      blockchainService.createCouponType.mockResolvedValue(
        mockBlockchainResult,
      );

      prismaService.$transaction.mockImplementation(async (callback: any) => {
        return await callback({
          voucher: {
            create: jest.fn().mockResolvedValue(mockVoucher),
          },
        });
      });

      await handler.execute(createVoucherDto);

      expect(prismaService.$transaction).toHaveBeenCalledWith(
        expect.any(Function),
        { timeout: 60000 },
      );
    });

    it('should store blockchain tokenId in voucher', async () => {
      prismaService.point.findUnique.mockResolvedValue(mockPoint);
      prismaService.merchant.findUnique.mockResolvedValue(mockMerchant);
      blockchainService.createCouponType.mockResolvedValue({
        typeId: '99999',
        hash: '0xdef456',
        blockNumber: 200,
      });

      let createdVoucherData: any;
      prismaService.$transaction.mockImplementation(async (callback: any) => {
        return await callback({
          voucher: {
            create: jest.fn().mockImplementation((data) => {
              createdVoucherData = data.data;
              return Promise.resolve(mockVoucher);
            }),
          },
        });
      });

      await handler.execute(createVoucherDto);

      expect(createdVoucherData.tokenId).toBe('99999');
    });
  });

  describe('getAvailableCodes', () => {
    it('should return available codes with default limit', async () => {
      const mockCodes = [
        { code: 'CODE1' },
        { code: 'CODE2' },
        { code: 'CODE3' },
      ];

      prismaService.voucherCode.findMany.mockResolvedValue(mockCodes);

      const result = await handler.getAvailableCodes('voucher-1');

      expect(result).toEqual(mockCodes);
      expect(prismaService.voucherCode.findMany).toHaveBeenCalledWith({
        where: {
          voucherId: 'voucher-1',
          isUsed: false,
        },
        take: 10,
        select: {
          code: true,
        },
      });
    });

    it('should return available codes with custom limit', async () => {
      const mockCodes = [{ code: 'CODE1' }, { code: 'CODE2' }];

      prismaService.voucherCode.findMany.mockResolvedValue(mockCodes);

      const result = await handler.getAvailableCodes('voucher-1', 5);

      expect(result).toEqual(mockCodes);
      expect(prismaService.voucherCode.findMany).toHaveBeenCalledWith({
        where: {
          voucherId: 'voucher-1',
          isUsed: false,
        },
        take: 5,
        select: {
          code: true,
        },
      });
    });

    it('should return empty array when no codes available', async () => {
      prismaService.voucherCode.findMany.mockResolvedValue([]);

      const result = await handler.getAvailableCodes('voucher-1');

      expect(result).toEqual([]);
    });
  });

  describe('exportAllCodes', () => {
    it('should export all codes with usage information', async () => {
      const mockCodes = [
        {
          code: 'CODE1',
          isUsed: true,
          usedBy: 'customer-1',
          usedAt: new Date('2024-01-15'),
        },
        {
          code: 'CODE2',
          isUsed: false,
          usedBy: null,
          usedAt: null,
        },
      ];

      prismaService.voucherCode.findMany.mockResolvedValue(mockCodes);

      const result = await handler.exportAllCodes('voucher-1');

      expect(result).toEqual(mockCodes);
      expect(prismaService.voucherCode.findMany).toHaveBeenCalledWith({
        where: { voucherId: 'voucher-1' },
        select: {
          code: true,
          isUsed: true,
          usedBy: true,
          usedAt: true,
        },
        orderBy: {
          createdAt: 'asc',
        },
      });
    });

    it('should return empty array when voucher has no codes', async () => {
      prismaService.voucherCode.findMany.mockResolvedValue([]);

      const result = await handler.exportAllCodes('voucher-1');

      expect(result).toEqual([]);
    });
  });
});
