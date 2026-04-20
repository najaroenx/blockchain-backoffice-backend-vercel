jest.mock('prisma/prisma.service', () => ({ PrismaService: jest.fn() }));

import { Test, TestingModule } from '@nestjs/testing';
import { ExternalCustomerController } from 'src/modules/external/controllers/external-customer.controller';
import { GetCustomerPhone } from 'src/modules/internal/customer/handlers/getCustomerByPhone.handler';
import { GetCustomerPhoneDevForResp } from 'src/modules/internal/customer/handlers/getCustomerPhoneDevForResp.handler';
import { GetCustomerPoints } from 'src/modules/internal/customer/handlers/getCustomerPoints.handler';
import { ClearCustomerByPhone } from 'src/modules/internal/customer/handlers/clearCustomerByPhone.handler';

describe('ExternalCustomerController', () => {
  let controller: ExternalCustomerController;
  let getCustomerByPhone: jest.Mocked<GetCustomerPhone>;
  let getCustomerPhoneDevForResp: jest.Mocked<GetCustomerPhoneDevForResp>;
  let getCustomerPoints: jest.Mocked<GetCustomerPoints>;
  let clearCustomerByPhone: jest.Mocked<ClearCustomerByPhone>;

  beforeEach(async () => {
    getCustomerByPhone = { executeDetailed: jest.fn() } as any;
    getCustomerPhoneDevForResp = { executeDetailed: jest.fn() } as any;
    getCustomerPoints = { execute: jest.fn() } as any;
    clearCustomerByPhone = { execute: jest.fn() } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExternalCustomerController],
      providers: [
        { provide: GetCustomerPhone, useValue: getCustomerByPhone },
        {
          provide: GetCustomerPhoneDevForResp,
          useValue: getCustomerPhoneDevForResp,
        },
        { provide: GetCustomerPoints, useValue: getCustomerPoints },
        { provide: ClearCustomerByPhone, useValue: clearCustomerByPhone },
      ],
    }).compile();

    controller = module.get<ExternalCustomerController>(
      ExternalCustomerController,
    );
  });

  it('getCustomerPointsBalance delegates to handler', async () => {
    getCustomerPoints.execute.mockResolvedValue({ points: 100 } as any);
    const result = await controller.getCustomerPointsBalance('081');
    expect(getCustomerPoints.execute).toHaveBeenCalledWith('081');
    expect(result).toEqual({ points: 100 });
  });

  it('getCustomerByPhoneDetailed delegates to executeDetailed', async () => {
    getCustomerPhoneDevForResp.executeDetailed.mockResolvedValue({
      id: 'c1',
    } as any);
    const result = await controller.getCustomerByPhoneDetailed('081');
    expect(getCustomerPhoneDevForResp.executeDetailed).toHaveBeenCalledWith(
      '081',
    );
    expect(result).toEqual({ id: 'c1' });
  });

  it('clearCustomer delegates to handler', async () => {
    clearCustomerByPhone.execute.mockResolvedValue({ cleared: true } as any);
    const result = await controller.clearCustomer('081');
    expect(clearCustomerByPhone.execute).toHaveBeenCalledWith('081');
    expect(result).toEqual({ cleared: true });
  });
});
