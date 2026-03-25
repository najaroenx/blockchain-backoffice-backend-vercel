jest.mock('prisma/prisma.service', () => ({ PrismaService: jest.fn() }));

import { Test, TestingModule } from '@nestjs/testing';
import { ExternalDashboardController } from 'src/modules/external/controllers/external-dashboard.controller';
import { GetMerchantRefDashboardHandler } from 'src/modules/internal/dashboard/handlers/get-merchantref-dashboard.handler';

describe('ExternalDashboardController', () => {
  let controller: ExternalDashboardController;
  let handler: jest.Mocked<GetMerchantRefDashboardHandler>;

  beforeEach(async () => {
    handler = { execute: jest.fn(), getCouponDropdown: jest.fn() } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExternalDashboardController],
      providers: [
        { provide: GetMerchantRefDashboardHandler, useValue: handler },
      ],
    }).compile();

    controller = module.get<ExternalDashboardController>(
      ExternalDashboardController,
    );
  });

  it('getMerchantRefDashboard delegates to handler', async () => {
    const query = { startDate: '2024-01-01' } as any;
    handler.execute.mockResolvedValue({ stats: true } as any);
    const result = await controller.getMerchantRefDashboard('ref1', query);
    expect(handler.execute).toHaveBeenCalledWith('ref1', query);
    expect(result).toEqual({ stats: true });
  });

  it('getMerchantRefCouponDropdown delegates to handler', async () => {
    handler.getCouponDropdown.mockResolvedValue({
      coupons: [
        {
          id: 'c1',
          name: 'Coupon 1',
          merchantRef: 'ref1',
          merchantRefName: 'Store Ref 1',
        },
      ],
    } as any);
    const result = await controller.getMerchantRefCouponDropdown('ref1');
    expect(handler.getCouponDropdown).toHaveBeenCalledWith('ref1');
    expect(result).toEqual({
      coupons: [
        {
          id: 'c1',
          name: 'Coupon 1',
          merchantRef: 'ref1',
          merchantRefName: 'Store Ref 1',
        },
      ],
    });
  });
});
