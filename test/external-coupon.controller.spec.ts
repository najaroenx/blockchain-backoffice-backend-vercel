jest.mock('prisma/prisma.service', () => ({ PrismaService: jest.fn() }));

import { Test, TestingModule } from '@nestjs/testing';
import { ExternalCouponController } from 'src/modules/external/controllers/external-coupon.controller';
import { VoucherDBService } from 'src/modules/internal/voucher/services/voucher-db.service';
import { GetCouponById } from 'src/modules/internal/voucher/handlers/getCouponById.handler';
import { GetVoucherByLatestCode } from 'src/modules/internal/voucher/handlers/getVoucherByLatestCode.handler';
import { GetMarketplaceListingsByMerchantRef } from 'src/modules/internal/voucher/handlers/getMarketplaceListingsByMerchantRef.handler';

describe('ExternalCouponController', () => {
  let controller: ExternalCouponController;
  let voucherService: jest.Mocked<VoucherDBService>;
  let getCouponById: jest.Mocked<GetCouponById>;
  let getVoucherByLatestCode: jest.Mocked<GetVoucherByLatestCode>;
  let getMarketplaceListings: jest.Mocked<GetMarketplaceListingsByMerchantRef>;

  beforeEach(async () => {
    voucherService = {
      getCustomerOwnedVouchers: jest.fn(),
      redeemVoucher: jest.fn(),
      redeemAISVoucher: jest.fn(),
    } as any;
    getCouponById = { execute: jest.fn() } as any;
    getVoucherByLatestCode = { execute: jest.fn() } as any;
    getMarketplaceListings = { execute: jest.fn() } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExternalCouponController],
      providers: [
        { provide: VoucherDBService, useValue: voucherService },
        { provide: GetCouponById, useValue: getCouponById },
        { provide: GetVoucherByLatestCode, useValue: getVoucherByLatestCode },
        {
          provide: GetMarketplaceListingsByMerchantRef,
          useValue: getMarketplaceListings,
        },
      ],
    }).compile();

    controller = module.get<ExternalCouponController>(ExternalCouponController);
  });

  it('getCouponById delegates to handler', async () => {
    getCouponById.execute.mockResolvedValue({ id: 'c1' } as any);
    const result = await controller.getCouponById('c1');
    expect(getCouponById.execute).toHaveBeenCalledWith('c1');
    expect(result).toEqual({ id: 'c1' });
  });

  it('getVoucherByLatestCode delegates to handler', async () => {
    getVoucherByLatestCode.execute.mockResolvedValue({ id: 'v1' } as any);

    const result = await controller.getVoucherByLatestCode(
      '8-BATCH-cmmcyastl005pzw010strv1uu-12-15',
      'unused',
    );

    expect(getVoucherByLatestCode.execute).toHaveBeenCalledWith(
      '8-BATCH-cmmcyastl005pzw010strv1uu-12-15',
      'unused',
    );
    expect(result).toEqual({ id: 'v1' });
  });

  it('getCustomerOwnedVouchers defaults page=1, limit=20, status=all', async () => {
    voucherService.getCustomerOwnedVouchers.mockResolvedValue({
      data: [],
    } as any);
    const result = await controller.getCustomerOwnedVouchers('081');
    expect(voucherService.getCustomerOwnedVouchers).toHaveBeenCalledWith(
      '081',
      'all',
      1,
      20,
    );
    expect(result).toEqual({ data: [] });
  });

  it('getCustomerOwnedVouchers parses page and limit', async () => {
    voucherService.getCustomerOwnedVouchers.mockResolvedValue({
      data: [],
    } as any);
    await controller.getCustomerOwnedVouchers('081', 'unused', '2', '10');
    expect(voucherService.getCustomerOwnedVouchers).toHaveBeenCalledWith(
      '081',
      'unused',
      2,
      10,
    );
  });

  it('redeemVoucher delegates to voucherService', async () => {
    voucherService.redeemVoucher.mockResolvedValue({ success: true } as any);
    const result = await controller.redeemVoucher({
      code: 'C1',
      phone: '081',
      merchantRef: 'ref1',
    });
    expect(voucherService.redeemVoucher).toHaveBeenCalledWith(
      'C1',
      '081',
      'ref1',
    );
    expect(result).toEqual({ success: true });
  });

  it('redeemAISVoucher delegates to voucherService', async () => {
    voucherService.redeemAISVoucher.mockResolvedValue({ success: true } as any);
    const result = await controller.redeemAISVoucher({
      code: 'AIS1',
      phone: '081',
      merchantRef: 'ref1',
      receiverPhone: '082',
    } as any);
    expect(voucherService.redeemAISVoucher).toHaveBeenCalledWith(
      'AIS1',
      '081',
      'ref1',
      '082',
    );
    expect(result).toEqual({ success: true });
  });

  it('getMarketplaceListingsByMerchantRef delegates with default pagination', async () => {
    getMarketplaceListings.execute.mockResolvedValue({ data: [] } as any);
    const result = await controller.getMarketplaceListingsByMerchantRef('ref1');
    expect(getMarketplaceListings.execute).toHaveBeenCalledWith('ref1', 1, 20);
    expect(result).toEqual({ data: [] });
  });

  it('getMarketplaceListingsByMerchantRef parses custom page and limit', async () => {
    getMarketplaceListings.execute.mockResolvedValue({ data: [] } as any);
    await controller.getMarketplaceListingsByMerchantRef('ref1', '3', '5');
    expect(getMarketplaceListings.execute).toHaveBeenCalledWith('ref1', 3, 5);
  });
});
