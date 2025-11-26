import { Test, TestingModule } from '@nestjs/testing';
import { ManageCouponHandler } from '../src/modules/voucher/handlers/manageCoupon.handler';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('ManageCouponHandler', () => {
  let handler: ManageCouponHandler;

  const mockPrismaService = {
    voucher: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    voucherCode: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrismaService)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ManageCouponHandler,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    handler = module.get<ManageCouponHandler>(ManageCouponHandler);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('updateVoucherCodesPointCost', () => {
    it('should update voucher codes point cost successfully', async () => {
      const input = {
        voucherId: 'voucher-123',
        amount: 10,
        price: 500,
      };

      const mockVoucher = {
        id: 'voucher-123',
        name: 'Test Voucher',
      };

      const mockVoucherCodes = [
        { id: 'code-1', code: 'ABC123', pointsCost: 100 },
        { id: 'code-2', code: 'DEF456', pointsCost: 100 },
      ];

      mockPrismaService.voucher.findUnique.mockResolvedValue(mockVoucher);
      mockPrismaService.voucherCode.findMany.mockResolvedValue(
        mockVoucherCodes,
      );
      mockPrismaService.voucherCode.updateMany.mockResolvedValue({
        count: 2,
      });

      const result = await handler.updateVoucherCodesPointCost(input);

      expect(result.success).toBe(true);
      expect(result.voucherId).toBe(input.voucherId);
      expect(result.updatedCount).toBe(2);
      expect(result.newPointsCost).toBe(input.price);
      expect(mockPrismaService.voucher.findUnique).toHaveBeenCalledWith({
        where: { id: input.voucherId },
      });
    });

    it('should throw NotFoundException when voucher not found', async () => {
      const input = {
        voucherId: 'invalid-id',
        amount: 10,
        price: 500,
      };

      mockPrismaService.voucher.findUnique.mockResolvedValue(null);

      await expect(handler.updateVoucherCodesPointCost(input)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException for invalid amount', async () => {
      const input = {
        voucherId: 'voucher-123',
        amount: -5,
        price: 500,
      };

      await expect(handler.updateVoucherCodesPointCost(input)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for invalid price', async () => {
      const input = {
        voucherId: 'voucher-123',
        amount: 10,
        price: -100,
      };

      await expect(handler.updateVoucherCodesPointCost(input)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException when no unused codes found', async () => {
      const input = {
        voucherId: 'voucher-123',
        amount: 10,
        price: 500,
      };

      const mockVoucher = {
        id: 'voucher-123',
        name: 'Test Voucher',
      };

      mockPrismaService.voucher.findUnique.mockResolvedValue(mockVoucher);
      mockPrismaService.voucherCode.findMany.mockResolvedValue([]);

      await expect(handler.updateVoucherCodesPointCost(input)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateAllVoucherCodesPointCost', () => {
    it('should update all voucher codes point cost successfully', async () => {
      const voucherId = 'voucher-123';
      const price = 800;

      const mockVoucher = {
        id: voucherId,
        name: 'Test Voucher',
        _count: {
          voucherCodes: 50,
        },
      };

      mockPrismaService.voucher.findUnique.mockResolvedValue(mockVoucher);
      mockPrismaService.voucherCode.updateMany.mockResolvedValue({
        count: 30,
      });

      const result = await handler.updateAllVoucherCodesPointCost(
        voucherId,
        price,
      );

      expect(result.success).toBe(true);
      expect(result.voucherId).toBe(voucherId);
      expect(result.updatedCount).toBe(30);
      expect(result.totalCodes).toBe(50);
      expect(result.newPointsCost).toBe(price);
    });

    it('should throw NotFoundException when voucher not found', async () => {
      const voucherId = 'invalid-id';
      const price = 800;

      mockPrismaService.voucher.findUnique.mockResolvedValue(null);

      await expect(
        handler.updateAllVoucherCodesPointCost(voucherId, price),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for invalid price', async () => {
      const voucherId = 'voucher-123';
      const price = -100;

      await expect(
        handler.updateAllVoucherCodesPointCost(voucherId, price),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getVoucherCodesStatistics', () => {
    it('should return statistics for voucher codes', async () => {
      const voucherId = 'voucher-123';

      const mockVoucherCodes = [
        {
          id: 'code-1',
          code: 'ABC123',
          pointsCost: 500,
          isUsed: false,
          usedBy: null,
          usedAt: null,
        },
        {
          id: 'code-2',
          code: 'DEF456',
          pointsCost: 500,
          isUsed: true,
          usedBy: 'customer-1',
          usedAt: new Date(),
        },
        {
          id: 'code-3',
          code: 'GHI789',
          pointsCost: 800,
          isUsed: false,
          usedBy: null,
          usedAt: null,
        },
      ];

      mockPrismaService.voucherCode.findMany.mockResolvedValue(
        mockVoucherCodes,
      );

      const result = await handler.getVoucherCodesStatistics(voucherId);

      expect(result.voucherId).toBe(voucherId);
      expect(result.totalCodes).toBe(3);
      expect(result.unusedCount).toBe(2);
      expect(result.usedCount).toBe(1);
      expect(result.priceGroups[500].count).toBe(2);
      expect(result.priceGroups[800].count).toBe(1);
    });

    it('should throw NotFoundException when no codes found', async () => {
      const voucherId = 'voucher-123';

      mockPrismaService.voucherCode.findMany.mockResolvedValue([]);

      await expect(
        handler.getVoucherCodesStatistics(voucherId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('resetVoucherCodesPointCost', () => {
    it('should reset voucher codes point cost', async () => {
      const voucherId = 'voucher-123';
      const originalPrice = 300;

      const mockVoucher = {
        id: voucherId,
        name: 'Test Voucher',
        _count: {
          voucherCodes: 20,
        },
      };

      mockPrismaService.voucher.findUnique.mockResolvedValue(mockVoucher);
      mockPrismaService.voucherCode.updateMany.mockResolvedValue({
        count: 15,
      });

      const result = await handler.resetVoucherCodesPointCost(
        voucherId,
        originalPrice,
      );

      expect(result.success).toBe(true);
      expect(result.newPointsCost).toBe(originalPrice);
    });
  });
});
