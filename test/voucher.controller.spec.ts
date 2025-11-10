import { Test, TestingModule } from '@nestjs/testing';
import { VoucherController } from '../src/modules/voucher/controllers/voucher.controller';
import { VoucherDBService } from '../src/modules/voucher/services/voucher-db.service';
import { VoucherStatus, VoucherValueType } from '@prisma/client';

describe('VoucherController', () => {
  let controller: VoucherController;

  const mockVoucherDBService = {
    getAllVouchers: jest.fn(),
    getActiveVouchers: jest.fn(),
    getVouchersByMerchant: jest.fn(),
    getVoucherById: jest.fn(),
    createVoucher: jest.fn(),
    updateVoucher: jest.fn(),
    deleteVoucher: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VoucherController],
      providers: [
        {
          provide: VoucherDBService,
          useValue: mockVoucherDBService,
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

      mockVoucherDBService.createVoucher.mockResolvedValue(mockCreatedVoucher);

      const result = await controller.createVoucher(createDto);

      expect(result).toBeDefined();
      expect(result.name).toBe('New Voucher');
      expect(mockVoucherDBService.createVoucher).toHaveBeenCalledWith({
        ...createDto,
        startDate: new Date(createDto.startDate),
        endDate: new Date(createDto.endDate),
        redeemCode: 'SAVE50',
      });
    });
  });

  describe('updateVoucher', () => {
    it('should update a voucher', async () => {
      const voucherId = 'voucher-123';
      const updateDto = {
        name: 'Updated Voucher',
        description: 'Updated description',
      };

      const mockUpdatedVoucher = {
        id: voucherId,
        ...updateDto,
        status: VoucherStatus.active,
        merchantName: 'Test Merchant',
        valueType: VoucherValueType.cash,
        value: 100,
        pointsCost: 50,
        startDate: new Date(),
        endDate: new Date('2025-12-31'),
        totalIssued: 100,
        totalRedeemed: 10,
      };

      mockVoucherDBService.updateVoucher.mockResolvedValue(mockUpdatedVoucher);

      const result = await controller.updateVoucher(voucherId, updateDto);

      expect(result).toBeDefined();
      expect(result.name).toBe('Updated Voucher');
      expect(mockVoucherDBService.updateVoucher).toHaveBeenCalledWith(
        voucherId,
        updateDto,
      );
    });

    it('should convert date strings when updating', async () => {
      const voucherId = 'voucher-123';
      const updateDto = {
        name: 'Updated Voucher',
        startDate: '2025-06-01',
        endDate: '2025-12-31',
      };

      const mockUpdatedVoucher = {
        id: voucherId,
        name: updateDto.name,
        startDate: new Date(updateDto.startDate),
        endDate: new Date(updateDto.endDate),
      };

      mockVoucherDBService.updateVoucher.mockResolvedValue(mockUpdatedVoucher);

      const result = await controller.updateVoucher(voucherId, updateDto);

      expect(result).toBeDefined();
      expect(mockVoucherDBService.updateVoucher).toHaveBeenCalledWith(
        voucherId,
        {
          name: updateDto.name,
          startDate: new Date(updateDto.startDate),
          endDate: new Date(updateDto.endDate),
        },
      );
    });
  });

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
      expect(result.id).toBe(voucherId);
      expect(mockVoucherDBService.deleteVoucher).toHaveBeenCalledWith(
        voucherId,
      );
    });
  });
});
