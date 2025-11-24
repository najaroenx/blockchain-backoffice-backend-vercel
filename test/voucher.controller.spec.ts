import { Test, TestingModule } from '@nestjs/testing';
import { VoucherController } from '../src/modules/voucher/controllers/voucher.controller';
import { VoucherDBService } from '../src/modules/voucher/services/voucher-db.service';
import { VoucherStatus, VoucherValueType } from '@prisma/client';
import { ManageCouponHandler } from '../src/modules/voucher/handlers/manageCoupon.handler';

describe('VoucherController', () => {
  let controller: VoucherController;

  const mockVoucherDBService = {
    getAllVouchers: jest.fn(),
    getActiveVouchers: jest.fn(),
    getVouchersByMerchant: jest.fn(),
    getVoucherById: jest.fn(),
    createVoucher: jest.fn(),
    createVoucherWithCodes: jest.fn(),
    updateVoucher: jest.fn(),
    deleteVoucher: jest.fn(),
  };

  const mockManageCouponHandler = {
    updateVoucherCodesPointCost: jest.fn(),
    updateAllVoucherCodesPointCost: jest.fn(),
    getVoucherCodesStatistics: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VoucherController],
      providers: [
        {
          provide: VoucherDBService,
          useValue: mockVoucherDBService,
        },
        {
          provide: ManageCouponHandler,
          useValue: mockManageCouponHandler,
        },
      ],
    }).compile();

    controller = module.get<VoucherController>(VoucherController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getAllVouchers', () => {
    it('should return all vouchers', async () => {
      const mockVouchers = [
        { id: 'voucher-1', name: 'Voucher 1' },
        { id: 'voucher-2', name: 'Voucher 2' },
      ];

      mockVoucherDBService.getAllVouchers.mockResolvedValue(mockVouchers);

      const result = await controller.getAllVouchers();

      expect(result).toBeDefined();
      expect(result.length).toBe(2);
      expect(mockVoucherDBService.getAllVouchers).toHaveBeenCalled();
    });
  });

  describe('getActiveVouchers', () => {
    it('should return only active vouchers', async () => {
      const mockActiveVouchers = [
        { id: 'voucher-1', name: 'Active Voucher', status: 'active' },
      ];

      mockVoucherDBService.getActiveVouchers.mockResolvedValue(
        mockActiveVouchers,
      );

      const result = await controller.getActiveVouchers();

      expect(result).toBeDefined();
      expect(result.length).toBe(1);
      expect(mockVoucherDBService.getActiveVouchers).toHaveBeenCalled();
    });
  });

  describe('getVouchersByMerchant', () => {
    it('should return vouchers for a specific merchant', async () => {
      const merchantId = 'merchant-123';
      const mockVouchers = [
        { id: 'voucher-1', name: 'Voucher 1', merchantId },
        { id: 'voucher-2', name: 'Voucher 2', merchantId },
      ];

      mockVoucherDBService.getVouchersByMerchant.mockResolvedValue(
        mockVouchers,
      );

      const result = await controller.getVouchersByMerchant(merchantId);

      expect(result).toBeDefined();
      expect(result.length).toBe(2);
      expect(mockVoucherDBService.getVouchersByMerchant).toHaveBeenCalledWith(
        merchantId,
      );
    });
  });

  describe('getVoucherById', () => {
    it('should return a voucher by id', async () => {
      const voucherId = 'voucher-123';
      const mockVoucher = {
        id: voucherId,
        name: 'Test Voucher',
        status: VoucherStatus.active,
      };

      mockVoucherDBService.getVoucherById.mockResolvedValue(mockVoucher);

      const result = await controller.getVoucherById(voucherId);

      expect(result).toBeDefined();
      expect(result.id).toBe(voucherId);
      expect(mockVoucherDBService.getVoucherById).toHaveBeenCalledWith(
        voucherId,
      );
    });
  });

  describe('createVoucher', () => {
    it('should create a new voucher', async () => {
      const createDto = {
        id: 'voucher-1',
        redeemCode: 'SAVE50',
        name: 'New Voucher',
        description: 'Test description',
        status: VoucherStatus.active,
        merchantName: 'Test Merchant',
        merchantId: 'merchant-1',
        valueType: VoucherValueType.percentage,
        value: 50,
        currency: 'USD',
        pointsCost: 100,
        pointId: 'point-1',
        startDate: '2025-01-01',
        endDate: '2025-12-31',
        totalIssued: 100,
        totalRedeemed: 0,
      };

      const mockCreatedVoucher = {
        ...createDto,
        startDate: new Date(createDto.startDate),
        endDate: new Date(createDto.endDate),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockVoucherDBService.createVoucherWithCodes.mockResolvedValue(
        mockCreatedVoucher,
      );

      const result = await controller.createVoucher(createDto);

      expect(result).toBeDefined();
      expect(mockVoucherDBService.createVoucherWithCodes).toHaveBeenCalledWith(
        createDto,
      );
    });
  });

  // updateVoucher method doesn't exist in controller, skipping these tests

  describe('deleteVoucher', () => {
    it('should delete a voucher', async () => {
      const voucherId = 'voucher-123';
      const mockDeletedVoucher = {
        id: voucherId,
        name: 'Deleted Voucher',
      };

      mockVoucherDBService.deleteVoucher.mockResolvedValue(mockDeletedVoucher);

      const result = await controller.deleteVoucher(voucherId);

      expect(result).toBeDefined();
      expect(mockVoucherDBService.deleteVoucher).toHaveBeenCalledWith(
        voucherId,
      );
    });
  });
});
