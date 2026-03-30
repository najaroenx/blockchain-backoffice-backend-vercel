jest.mock('prisma/prisma.service', () => ({ PrismaService: jest.fn() }));

import { Test, TestingModule } from '@nestjs/testing';
import { CustomerController } from 'src/modules/internal/customer/controllers/customer.controller';
import { GetAllCustomersByMerchantWithWallet } from 'src/modules/internal/customer/handlers/getAllCustomersByMerchantWithWallet.handler';
import { GetCustomersByMerchantId } from 'src/modules/internal/customer/handlers/getCustomersByMerchantId.handler';
import { GetCustomerById } from 'src/modules/internal/customer/handlers/getCustomerById.handler';
import { GetCustomerPhone } from 'src/modules/internal/customer/handlers/getCustomerByPhone.handler';
import { GetCustomerPoints } from 'src/modules/internal/customer/handlers/getCustomerPoints.handler';
import { CreateCustomer } from 'src/modules/internal/customer/handlers/createCustomer.handler';
import { GetCustomerListDev } from 'src/modules/internal/customer/handlers/getCustomerListDev.handler';
import { UpdateCustomer } from 'src/modules/internal/customer/handlers/updateCustomer.handler';
import { GetCustomerPhoneDevForResp } from 'src/modules/internal/customer/handlers/getCustomerPhoneDevForResp.handler';
import { RegisterCustomerDev } from 'src/modules/internal/customer/handlers/registerCustomer.dev.handler';

describe('CustomerController', () => {
  let controller: CustomerController;
  let getCustomersByMerchantId: jest.Mocked<GetCustomersByMerchantId>;
  let getAllCustomersByMerchantWithWallet: jest.Mocked<GetAllCustomersByMerchantWithWallet>;
  let getCustomerById: jest.Mocked<GetCustomerById>;
  let getCustomerByPhone: jest.Mocked<GetCustomerPhone>;
  let createCustomer: jest.Mocked<CreateCustomer>;
  let getCustomerListDev: jest.Mocked<GetCustomerListDev>;
  let updateCustomer: jest.Mocked<UpdateCustomer>;
  let getCustomerPhoneDevForResp: jest.Mocked<GetCustomerPhoneDevForResp>;
  let registerCustomerDev: jest.Mocked<RegisterCustomerDev>;

  beforeEach(async () => {
    getCustomersByMerchantId = { execute: jest.fn() } as any;
    getAllCustomersByMerchantWithWallet = { execute: jest.fn() } as any;
    getCustomerById = { execute: jest.fn() } as any;
    getCustomerByPhone = { execute: jest.fn() } as any;
    createCustomer = { execute: jest.fn() } as any;
    getCustomerListDev = { execute: jest.fn() } as any;
    updateCustomer = { execute: jest.fn() } as any;
    getCustomerPhoneDevForResp = { execute: jest.fn() } as any;
    registerCustomerDev = { execute: jest.fn() } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomerController],
      providers: [
        {
          provide: GetCustomersByMerchantId,
          useValue: getCustomersByMerchantId,
        },
        {
          provide: GetAllCustomersByMerchantWithWallet,
          useValue: getAllCustomersByMerchantWithWallet,
        },
        { provide: GetCustomerById, useValue: getCustomerById },
        { provide: GetCustomerPhone, useValue: getCustomerByPhone },
        { provide: GetCustomerPoints, useValue: { execute: jest.fn() } },
        { provide: CreateCustomer, useValue: createCustomer },
        { provide: GetCustomerListDev, useValue: getCustomerListDev },
        { provide: UpdateCustomer, useValue: updateCustomer },
        {
          provide: GetCustomerPhoneDevForResp,
          useValue: getCustomerPhoneDevForResp,
        },
        { provide: RegisterCustomerDev, useValue: registerCustomerDev },
      ],
    }).compile();

    controller = module.get<CustomerController>(CustomerController);
  });

  it('createCustomer delegates to handler', async () => {
    const body = { phone: '0812345678', name: 'John' } as any;
    createCustomer.execute.mockResolvedValue({ id: 'c1' });
    const result = await controller.createCustomer('m1', body);
    expect(createCustomer.execute).toHaveBeenCalledWith('m1', body);
    expect(result).toEqual({ id: 'c1' });
  });

  it('getCustomersByMerchant delegates to handler', async () => {
    const pageOpts = { page: 1, take: 10 } as any;
    getCustomersByMerchantId.execute.mockResolvedValue({ data: [] } as any);
    const result = await controller.getCustomersByMerchant('m1', pageOpts);
    expect(getCustomersByMerchantId.execute).toHaveBeenCalledWith(
      'm1',
      pageOpts,
    );
    expect(result).toEqual({ data: [] });
  });

  it('getAllCustomersByMerchantWithWallet delegates to handler', async () => {
    getAllCustomersByMerchantWithWallet.execute.mockResolvedValue({
      customers: [{ id: 'c1', wallet: { id: 'w1' } }],
      counts: 1,
    } as any);

    const result = await controller.getAllCustomersByMerchantWithWallet('m1');

    expect(getAllCustomersByMerchantWithWallet.execute).toHaveBeenCalledWith(
      'm1',
    );
    expect(result).toEqual({
      customers: [{ id: 'c1', wallet: { id: 'w1' } }],
      counts: 1,
    });
  });

  it('getCustomerById delegates to handler', async () => {
    getCustomerById.execute.mockResolvedValue({ id: 'c1' } as any);
    const result = await controller.getCustomerById('c1', 'm1');
    expect(getCustomerById.execute).toHaveBeenCalledWith('m1', 'c1');
    expect(result).toEqual({ id: 'c1' });
  });

  it('getCustomerByPhone delegates to getCustomerPhoneDevForResp', async () => {
    getCustomerPhoneDevForResp.execute.mockResolvedValue({
      status: 200,
    } as any);
    const result = await controller.getCustomerByPhone(
      '0812345678',
      'm1',
      'https://cb.com',
    );
    expect(getCustomerPhoneDevForResp.execute).toHaveBeenCalledWith(
      'm1',
      '0812345678',
      'https://cb.com',
    );
    expect(result).toEqual({ status: 200 });
  });

  it('getWallet delegates to GetCustomerByPhone handler', async () => {
    getCustomerByPhone.execute.mockResolvedValue({ wallet: '0x' } as any);
    const result = await controller.getWallet('m1', '0812345678');
    expect(getCustomerByPhone.execute).toHaveBeenCalledWith('m1', '0812345678');
    expect(result).toEqual({ wallet: '0x' });
  });

  it('getAllCustomers delegates to getCustomerListDev', async () => {
    const pageOpts = { page: 1 } as any;
    getCustomerListDev.execute.mockResolvedValue([] as any);
    const result = await controller.getAllCustomers(pageOpts);
    expect(getCustomerListDev.execute).toHaveBeenCalledWith(pageOpts);
    expect(result).toEqual([]);
  });

  it('updateCustomer delegates to handler', async () => {
    const dto = { name: 'Updated' } as any;
    updateCustomer.execute.mockResolvedValue({ id: 'c1' } as any);
    const result = await controller.updateCustomer('c1', dto);
    expect(updateCustomer.execute).toHaveBeenCalledWith('c1', dto);
    expect(result).toEqual({ id: 'c1' });
  });
});
