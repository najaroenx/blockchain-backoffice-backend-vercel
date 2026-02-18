import { Test, TestingModule } from '@nestjs/testing';
import { VoucherController } from '../src/modules/internal/voucher/controllers/voucher.controller';
import { VoucherDBService } from '../src/modules/internal/voucher/services/voucher-db.service';
import { VoucherStatus, VoucherValueType } from '@prisma/client';
import { ManageCouponHandler } from '../src/modules/internal/voucher/handlers/manageCoupon.handler';
import { GetMarketplaceListings } from '../src/modules/internal/voucher/handlers/getMarketplaceListings.handler';
import { MerchantBuyCouponFromSeller } from '../src/modules/internal/voucher/handlers/merchantBuyCouponFromSeller.handler';
import { SellerListOnMarketplace } from '../src/modules/internal/voucher/handlers/sellerListOnMarketplace.handler';
import { GetSellerVouchers } from '../src/modules/internal/voucher/handlers/getSellerVouchers.handler';
import { BatchListOnMarketplaceHandler } from '../src/modules/internal/voucher/handlers/batchListOnMarketplace.handler';
import { GetSellerListingsHandler } from '../src/modules/internal/voucher/handlers/getSellerListings.handler';
import { GetListingBatchDetailHandler } from '../src/modules/internal/voucher/handlers/getListingBatchDetail.handler';
import { GetMarketplaceListingsEndUser } from '../src/modules/internal/voucher/handlers/getMarketplaceListtingEnduser.handler';
import { GetCouponById } from '../src/modules/internal/voucher/handlers/getCouponById.handler';

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

  const mockGetMarketplaceListings = {
    execute: jest.fn(),
  };

  const mockMerchantBuyHandler = {
    execute: jest.fn(),
  };

  const mockSellerListHandler = {
    execute: jest.fn(),
  };

  const mockGetSellerVouchersHandler = {
    execute: jest.fn(),
  };

  const mockBatchListHandler = {
    execute: jest.fn(),
  };

  const mockGetSellerListingsHandler = {
    execute: jest.fn(),
  };

  const mockGetListingBatchDetailHandler = {
    execute: jest.fn(),
  };

  const mockGetMarketplaceListingsEndUser = {
    execute: jest.fn(),
  };

  const mockGetCouponByIdHandler = {
    execute: jest.fn(),
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
          provide: GetMarketplaceListings,
          useValue: mockGetMarketplaceListings,
        },
        {
          provide: ManageCouponHandler,
          useValue: mockManageCouponHandler,
        },
        {
          provide: MerchantBuyCouponFromSeller,
          useValue: mockMerchantBuyHandler,
        },
        {
          provide: SellerListOnMarketplace,
          useValue: mockSellerListHandler,
        },
        {
          provide: GetSellerVouchers,
          useValue: mockGetSellerVouchersHandler,
        },
        {
          provide: BatchListOnMarketplaceHandler,
          useValue: mockBatchListHandler,
        },
        {
          provide: GetSellerListingsHandler,
          useValue: mockGetSellerListingsHandler,
        },
        {
          provide: GetListingBatchDetailHandler,
          useValue: mockGetListingBatchDetailHandler,
        },
        {
          provide: GetMarketplaceListingsEndUser,
          useValue: mockGetMarketplaceListingsEndUser,
        },
        {
          provide: GetCouponById,
          useValue: mockGetCouponByIdHandler,
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

  describe('getVoucherValueTypes', () => {
    it('should return VoucherValueType enum values and descriptions', async () => {
      const result = await controller.getVoucherValueTypes();
      expect(result.values).toBeDefined();
      expect(result.description).toBeDefined();
      expect(result.description).toHaveProperty('percentage');
      expect(result.description).toHaveProperty('cash');
    });
  });

  describe('getSellerMarketplaceListings', () => {
    it('should call getMarketplaceListings with sellerOnly=true and parsed pagination', async () => {
      mockGetMarketplaceListings.execute.mockResolvedValue({ listings: [] });
      await controller.getSellerMarketplaceListings('2', '10');
      expect(mockGetMarketplaceListings.execute).toHaveBeenCalledWith(
        undefined,
        true,
        2,
        10,
      );
    });

    it('should use undefined for page/limit when not provided', async () => {
      mockGetMarketplaceListings.execute.mockResolvedValue({ listings: [] });
      await controller.getSellerMarketplaceListings(undefined, undefined);
      expect(mockGetMarketplaceListings.execute).toHaveBeenCalledWith(
        undefined,
        true,
        undefined,
        undefined,
      );
    });
  });

  describe('getSellerVouchers', () => {
    it('should call handler with merchantId', async () => {
      mockGetSellerVouchersHandler.execute.mockResolvedValue({ vouchers: [] });
      await controller.getSellerVouchers('m1');
      expect(mockGetSellerVouchersHandler.execute).toHaveBeenCalledWith('m1');
    });
  });

  describe('getAvailableVouchersForCustomers', () => {
    it('should delegate to marketplace listings handler', async () => {
      mockGetMarketplaceListings.execute.mockResolvedValue({ listings: [] });
      await controller.getAvailableVouchersForCustomers('m1');
      expect(mockGetMarketplaceListings.execute).toHaveBeenCalledWith('m1');
    });
  });

  describe('getAvailableVouchersForEndUser', () => {
    it('should delegate to end-user marketplace handler', async () => {
      mockGetMarketplaceListingsEndUser.execute.mockResolvedValue({
        listings: [],
      });
      await controller.getAvailableVouchersForEndUser('m1');
      expect(mockGetMarketplaceListingsEndUser.execute).toHaveBeenCalledWith(
        'm1',
      );
    });
  });

  describe('searchVoucherCodesByGroup', () => {
    it('should return 400 when merchantId or groupId are missing', async () => {
      const result = await controller.searchVoucherCodesByGroup(
        '',
        '',
        undefined,
        undefined,
        undefined,
      );
      expect(result).toEqual({
        statusCode: 400,
        message: 'merchantId and groupId are required',
        data: null,
      });
    });

    it('should parse pagination params and call service', async () => {
      (mockVoucherDBService as any).getVoucherCodesByGroup = jest
        .fn()
        .mockResolvedValue({ data: [] });
      await controller.searchVoucherCodesByGroup('m1', 'g1', '2', '5', '10');
      expect(
        (mockVoucherDBService as any).getVoucherCodesByGroup,
      ).toHaveBeenCalledWith('m1', 'g1', 2, 5, 10);
    });
  });

  describe('getVoucherCodesByGroup', () => {
    it('should use default pagination values', async () => {
      (mockVoucherDBService as any).getVoucherCodesByGroup = jest
        .fn()
        .mockResolvedValue({ data: [] });
      await controller.getVoucherCodesByGroup('m1', 'g1');
      expect(
        (mockVoucherDBService as any).getVoucherCodesByGroup,
      ).toHaveBeenCalledWith('m1', 'g1', 1, 0, 20);
    });
  });

  describe('activateVoucher', () => {
    it('should call activateVoucher on service', async () => {
      (mockVoucherDBService as any).activateVoucher = jest
        .fn()
        .mockResolvedValue({ activated: true });
      const result = await controller.activateVoucher('v1', {
        pointId: 'p1',
      } as any);
      expect(result).toEqual({ activated: true });
    });
  });

  describe('createVoucherByDev', () => {
    it('should call createVoucherByDev on service', async () => {
      (mockVoucherDBService as any).createVoucherByDev = jest
        .fn()
        .mockResolvedValue({ id: 'v1' });
      const result = await controller.createVoucherByDev('m1', {
        name: 'test',
        amount: 10,
      } as any);
      expect(result).toEqual({ id: 'v1' });
    });
  });

  describe('updateVoucherCodesPrice', () => {
    it('should call manageCouponHandler with voucherId spread', async () => {
      mockManageCouponHandler.updateVoucherCodesPointCost.mockResolvedValue({
        updated: true,
      } as any);
      await controller.updateVoucherCodesPrice('v1', { price: 100 } as any);
      expect(
        mockManageCouponHandler.updateVoucherCodesPointCost,
      ).toHaveBeenCalledWith({ voucherId: 'v1', price: 100 });
    });
  });

  describe('updateAllVoucherCodesPrice', () => {
    it('should call manageCouponHandler with all params', async () => {
      mockManageCouponHandler.updateAllVoucherCodesPointCost.mockResolvedValue({
        updated: true,
      } as any);
      await controller.updateAllVoucherCodesPrice('v1', {
        price: 200,
        name: 'n',
        description: 'd',
        value: 10,
        endDate: '2025-12-31',
      } as any);
      expect(
        mockManageCouponHandler.updateAllVoucherCodesPointCost,
      ).toHaveBeenCalledWith('v1', 200, 'n', 'd', 10, '2025-12-31');
    });
  });

  describe('validateVoucherCode', () => {
    it('should call validateVoucherCode on service', async () => {
      (mockVoucherDBService as any).validateVoucherCode = jest
        .fn()
        .mockResolvedValue({ valid: true });
      expect(await controller.validateVoucherCode('CODE1')).toEqual({
        valid: true,
      });
    });
  });

  describe('sellerListOnMarketplace', () => {
    it('should call handler with spread dto params', async () => {
      mockSellerListHandler.execute.mockResolvedValue({ success: true } as any);
      await controller.sellerListOnMarketplace({
        voucherId: 'v1',
        amount: 5,
        pricePerUnitTHB: 100,
        sellerWalletAddress: '0x1',
      } as any);
      expect(mockSellerListHandler.execute).toHaveBeenCalledWith(
        'v1',
        5,
        100,
        '0x1',
        undefined,
        undefined,
      );
    });
  });

  describe('sellerBatchListOnMarketplace', () => {
    it('should call batchListHandler.execute', async () => {
      mockBatchListHandler.execute.mockResolvedValue({ success: true } as any);
      const body = { items: [] } as any;
      await controller.sellerBatchListOnMarketplace('m1', body);
      expect(mockBatchListHandler.execute).toHaveBeenCalledWith('m1', body);
    });
  });

  describe('getSellerListings', () => {
    it('should return 400 when walletAddress empty', async () => {
      const result = await controller.getSellerListings(
        '',
        undefined,
        undefined,
        undefined,
      );
      expect(result).toEqual({
        statusCode: 400,
        message: 'walletAddress is required',
        data: null,
      });
    });

    it('should parse pagination and call handler', async () => {
      mockGetSellerListingsHandler.execute.mockResolvedValue({
        data: [],
      } as any);
      await controller.getSellerListings('0x1', '2', '10', 'ACTIVE');
      expect(mockGetSellerListingsHandler.execute).toHaveBeenCalledWith(
        '0x1',
        2,
        10,
        'ACTIVE',
      );
    });
  });

  describe('getListingBatchDetail', () => {
    it('should call handler with batchId', async () => {
      mockGetListingBatchDetailHandler.execute.mockResolvedValue({
        id: 'b1',
      } as any);
      expect(await controller.getListingBatchDetail('b1')).toEqual({
        id: 'b1',
      });
    });
  });

  describe('merchantBuyCouponFromSeller', () => {
    it('should call handler with dto params', async () => {
      mockMerchantBuyHandler.execute.mockResolvedValue({
        success: true,
      } as any);
      await controller.merchantBuyCouponFromSeller({
        listingId: 'l1',
        amount: 2,
        merchantId: 'm1',
      } as any);
      expect(mockMerchantBuyHandler.execute).toHaveBeenCalledWith(
        'l1',
        2,
        'm1',
      );
    });
  });

  describe('buyCouponFromMarketplace', () => {
    it('should call voucherService.buyCouponFromMarketplace with dto params', async () => {
      (mockVoucherDBService as any).buyCouponFromMarketplace = jest
        .fn()
        .mockResolvedValue({ success: true });
      await controller.buyCouponFromMarketplace({
        voucherGroupId: 'vg1',
        pointId: 'p1',
        phone: '089',
      } as any);
      expect(
        (mockVoucherDBService as any).buyCouponFromMarketplace,
      ).toHaveBeenCalledWith('vg1', 'p1', '089');
    });
  });
});
