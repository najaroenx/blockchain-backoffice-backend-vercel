import { Test, TestingModule } from '@nestjs/testing';
import { VoucherDBService } from '../src/modules/voucher/services/voucher-db.service';
import { VoucherRepository } from '../src/modules/voucher/voucher.repository';
import { VoucherStatus, VoucherValueType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVoucherWithCodes } from '../src/modules/voucher/handlers/createVoucherWithCodes.handler';

describe('VoucherDBService', () => {
  let service: VoucherDBService;

  const mockVoucherRepository = {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const mockPrismaService = {
    voucher: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    voucherCode: {
      createMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockCreateVoucherWithCodes = {
    execute: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VoucherDBService,
        {
          provide: VoucherRepository,
          useValue: mockVoucherRepository,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: CreateVoucherWithCodes,
          useValue: mockCreateVoucherWithCodes,
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

  describe('createVoucher', () => {
    it('should create a voucher successfully', async () => {
      const voucherData = {
        id: 'voucher-1',
        name: 'Holiday Sale',
        description: '50% off',
        status: VoucherStatus.active,
        merchantName: 'Test Merchant',
        merchantId: 'merchant-1',
        valueType: VoucherValueType.percentage,
        value: 50,
        currency: 'USD',
        pointsCost: 100,
        startDate: new Date(),
        endDate: new Date('2025-12-31'),
        totalIssued: 100,
        totalRedeemed: 0,
        redeemCode: 'SAVE50',
      };

      const mockVoucher = {
        ...voucherData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockVoucherRepository.create.mockResolvedValue(mockVoucher);

      const result = await service.createVoucher(voucherData);

      expect(result).toBeDefined();
      expect(result.name).toBe('Holiday Sale');
      expect(result.status).toBe(VoucherStatus.active);
      expect(mockVoucherRepository.create).toHaveBeenCalledWith({
        data: voucherData,
      });
    });
  });

  describe('getVoucherById', () => {
    it('should return a voucher by id', async () => {
      const voucherId = 'voucher-1';
      const mockVoucher = {
        id: voucherId,
        name: 'Test Voucher',
        description: 'Test Description',
        status: VoucherStatus.active,
        merchantName: 'Test Merchant',
        merchantId: 'merchant-1',
        valueType: VoucherValueType.cash,
        value: 100,
        currency: 'USD',
        pointsCost: 50,
        startDate: new Date(),
        endDate: new Date('2025-12-31'),
        totalIssued: 100,
        totalRedeemed: 10,
        imageUrl: null,
        limitPerMember: null,
        redeemCode: 'TEST123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockVoucherRepository.findUnique.mockResolvedValue(mockVoucher);

      const result = await service.getVoucherById(voucherId);

      expect(result).toBeDefined();
      expect(result.id).toBe(voucherId);
      expect(mockVoucherRepository.findUnique).toHaveBeenCalledWith({
        where: { id: voucherId },
      });
    });
  });

  describe('getVouchersByMerchant', () => {
    it('should return vouchers for a merchant', async () => {
      const merchantId = 'merchant-1';
      const mockVouchers = [
        {
          id: 'voucher-1',
          name: 'Voucher 1',
          merchantId,
          status: VoucherStatus.active,
        },
        {
          id: 'voucher-2',
          name: 'Voucher 2',
          merchantId,
          status: VoucherStatus.upcoming,
        },
      ];

      mockVoucherRepository.findMany.mockResolvedValue(mockVouchers);

      const result = await service.getVouchersByMerchant(merchantId);

      expect(result).toBeDefined();
      expect(result.length).toBe(2);
      expect(mockVoucherRepository.findMany).toHaveBeenCalledWith({
        where: { merchantId },
        include: { merchant: true },
      });
    });
  });

  describe('getActiveVouchers', () => {
    it('should return only active vouchers', async () => {
      const mockActiveVouchers = [
        {
          id: 'voucher-1',
          name: 'Active Voucher 1',
          status: VoucherStatus.active,
        },
        {
          id: 'voucher-2',
          name: 'Active Voucher 2',
          status: VoucherStatus.active,
        },
      ];

      mockVoucherRepository.findMany.mockResolvedValue(mockActiveVouchers);

      const result = await service.getActiveVouchers();

      expect(result).toBeDefined();
      expect(result.length).toBe(2);
      expect(mockVoucherRepository.findMany).toHaveBeenCalledWith({
        where: { status: VoucherStatus.active },
        include: { merchant: true },
      });
    });
  });

  describe('updateVoucher', () => {
    it('should update a voucher successfully', async () => {
      const voucherId = 'voucher-1';
      const updateData = {
        name: 'Updated Voucher',
        description: 'Updated Description',
      };

      const mockUpdatedVoucher = {
        id: voucherId,
        ...updateData,
        status: VoucherStatus.active,
        merchantName: 'Test Merchant',
        merchantId: 'merchant-1',
        valueType: VoucherValueType.percentage,
        value: 50,
        currency: 'USD',
        pointsCost: 100,
        startDate: new Date(),
        endDate: new Date('2025-12-31'),
        totalIssued: 100,
        totalRedeemed: 0,
        imageUrl: null,
        limitPerMember: null,
        redeemCode: 'UPDATE123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockVoucherRepository.update.mockResolvedValue(mockUpdatedVoucher);

      const result = await service.updateVoucher(voucherId, updateData);

      expect(result).toBeDefined();
      expect(result.name).toBe('Updated Voucher');
      expect(mockVoucherRepository.update).toHaveBeenCalledWith({
        where: { id: voucherId },
        data: updateData,
      });
    });
  });

  describe('deleteVoucher', () => {
    it('should delete a voucher successfully', async () => {
      const voucherId = 'voucher-1';
      const mockResult = {
        voucher: {
          id: voucherId,
          name: 'Deleted Voucher',
        },
        deletedCodesCount: 10,
      };

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback({
          voucherCode: {
            count: jest.fn().mockResolvedValue(10),
          },
          voucher: {
            findUnique: jest.fn().mockResolvedValue({
              id: voucherId,
              name: 'Deleted Voucher',
              _count: {
                voucherCodes: 10,
              },
            }),
            delete: jest.fn().mockResolvedValue(mockResult.voucher),
          },
        });
      });

      const result = await service.deleteVoucher(voucherId);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.deletedCodesCount).toBe(10);
    });
  });

  describe('getAllVouchers', () => {
    it('should return all vouchers', async () => {
      const mockVouchers = [
        { id: 'voucher-1', name: 'Voucher 1' },
        { id: 'voucher-2', name: 'Voucher 2' },
        { id: 'voucher-3', name: 'Voucher 3' },
      ];

      mockVoucherRepository.findMany.mockResolvedValue(mockVouchers);

      const result = await service.getAllVouchers();

      expect(result).toBeDefined();
      expect(result.length).toBe(3);
      expect(mockVoucherRepository.findMany).toHaveBeenCalledWith({
        include: { merchant: true },
      });
    });
  });
});
