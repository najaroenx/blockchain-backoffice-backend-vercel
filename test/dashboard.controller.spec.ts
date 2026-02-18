jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { DashboardController } from 'src/modules/internal/dashboard/controllers/dashboard.controller';
import { DashboardService } from 'src/modules/internal/dashboard/handlers/dashboard.handler';
import { GetMarketerDashboardHandler } from 'src/modules/internal/dashboard/handlers/get-marketer-dashboard.handler';
import { GetSellerDashboardHandler } from 'src/modules/internal/dashboard/handlers/get-seller-dashboard.handler';
import { GetMerchantRefDashboardHandler } from 'src/modules/internal/dashboard/handlers/get-merchantref-dashboard.handler';

describe('DashboardController', () => {
  let controller: DashboardController;
  let dashboardService: any;
  let marketerHandler: any;
  let sellerHandler: any;
  let merchantRefHandler: any;

  beforeEach(async () => {
    dashboardService = { execute: jest.fn() };
    marketerHandler = { execute: jest.fn(), getCouponDropdown: jest.fn() };
    sellerHandler = {
      execute: jest.fn(),
      getCouponDropdown: jest.fn(),
      getMerchants: jest.fn(),
    };
    merchantRefHandler = { execute: jest.fn(), getCouponDropdown: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        { provide: DashboardService, useValue: dashboardService },
        { provide: GetMarketerDashboardHandler, useValue: marketerHandler },
        { provide: GetSellerDashboardHandler, useValue: sellerHandler },
        {
          provide: GetMerchantRefDashboardHandler,
          useValue: merchantRefHandler,
        },
      ],
    }).compile();

    controller = module.get(DashboardController);
  });

  it('getData - legacy dashboard', async () => {
    dashboardService.execute.mockResolvedValue({ stats: {} } as any);
    const result = await controller.getData('m1');
    expect(dashboardService.execute).toHaveBeenCalledWith('m1');
    expect(result).toEqual({ stats: {} });
  });

  it('getMarketerDashboard', async () => {
    marketerHandler.execute.mockResolvedValue({ couponCount: {} } as any);
    const result = await controller.getMarketerDashboard('m1', {
      startDate: '2025-01-01',
    } as any);
    expect(marketerHandler.execute).toHaveBeenCalledWith('m1', {
      startDate: '2025-01-01',
    });
    expect(result).toEqual({ couponCount: {} });
  });

  it('getSellerDashboard', async () => {
    sellerHandler.execute.mockResolvedValue({ overallSummary: {} } as any);
    const result = await controller.getSellerDashboard('s1', {
      startDate: '2025-01-01',
    } as any);
    expect(sellerHandler.execute).toHaveBeenCalledWith('s1', {
      startDate: '2025-01-01',
    });
    expect(result).toEqual({ overallSummary: {} });
  });

  it('getMarketerCouponDropdown', async () => {
    marketerHandler.getCouponDropdown.mockResolvedValue({
      coupons: [{ id: 'c1', name: 'C1' }],
    } as any);
    const result = await controller.getMarketerCouponDropdown('m1');
    expect(marketerHandler.getCouponDropdown).toHaveBeenCalledWith('m1');
    expect(result).toEqual({ coupons: [{ id: 'c1', name: 'C1' }] });
  });

  it('getSellerCouponDropdown', async () => {
    sellerHandler.getCouponDropdown.mockResolvedValue({ coupons: [] } as any);
    const result = await controller.getSellerCouponDropdown('s1', {
      marketerMerchantId: 'mk1',
    } as any);
    expect(sellerHandler.getCouponDropdown).toHaveBeenCalledWith('s1', 'mk1');
    expect(result).toEqual({ coupons: [] });
  });

  it('getSellerMerchants', async () => {
    sellerHandler.getMerchants.mockResolvedValue({ merchants: [] } as any);
    const result = await controller.getSellerMerchants('s1', {
      couponIds: ['c1', 'c2'],
    } as any);
    expect(sellerHandler.getMerchants).toHaveBeenCalledWith('s1', ['c1', 'c2']);
    expect(result).toEqual({ merchants: [] });
  });
});
