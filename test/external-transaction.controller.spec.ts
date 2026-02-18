jest.mock('prisma/prisma.service', () => ({ PrismaService: jest.fn() }));

import { Test, TestingModule } from '@nestjs/testing';
import { ExternalTransactionController } from 'src/modules/external/controllers/external-transaction.controller';
import { GetAllTransactionsByCustomerPhone } from 'src/modules/internal/transaction/handlers/getAllTransactionsByCustomerPhone.handler';
import { GetPointTransactionsByCustomerPhone } from 'src/modules/internal/transaction/handlers/getPointTransactionsByCustomerPhone.handler';
import { GetVoucherTransactionsByCustomerPhone } from 'src/modules/internal/transaction/handlers/getVoucherTransactionsByCustomerPhone.handler';
import { GetTransactionById } from 'src/modules/internal/transaction/handlers/getTransactionById.handler';
import { GetTransactionByMerchantRef } from 'src/modules/internal/transaction/handlers/getTransactionByMerchantRef.handler';

describe('ExternalTransactionController', () => {
  let controller: ExternalTransactionController;
  let getAllByPhone: jest.Mocked<GetAllTransactionsByCustomerPhone>;
  let getPointByPhone: jest.Mocked<GetPointTransactionsByCustomerPhone>;
  let getVoucherByPhone: jest.Mocked<GetVoucherTransactionsByCustomerPhone>;
  let getById: jest.Mocked<GetTransactionById>;
  let getByMerchantRef: jest.Mocked<GetTransactionByMerchantRef>;

  beforeEach(async () => {
    getAllByPhone = { execute: jest.fn() } as any;
    getPointByPhone = { execute: jest.fn() } as any;
    getVoucherByPhone = { execute: jest.fn() } as any;
    getById = { execute: jest.fn() } as any;
    getByMerchantRef = { execute: jest.fn() } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExternalTransactionController],
      providers: [
        { provide: GetAllTransactionsByCustomerPhone, useValue: getAllByPhone },
        {
          provide: GetPointTransactionsByCustomerPhone,
          useValue: getPointByPhone,
        },
        {
          provide: GetVoucherTransactionsByCustomerPhone,
          useValue: getVoucherByPhone,
        },
        { provide: GetTransactionById, useValue: getById },
        { provide: GetTransactionByMerchantRef, useValue: getByMerchantRef },
      ],
    }).compile();

    controller = module.get<ExternalTransactionController>(
      ExternalTransactionController,
    );
  });

  it('getAllTransactionsByCustomer delegates to handler', async () => {
    getAllByPhone.execute.mockResolvedValue([] as any);
    const result = await controller.getAllTransactionsByCustomer('081');
    expect(getAllByPhone.execute).toHaveBeenCalledWith('081');
    expect(result).toEqual([]);
  });

  it('getPointTransactionsCustomer passes null merchantId', async () => {
    getPointByPhone.execute.mockResolvedValue([] as any);
    const result = await controller.getPointTransactionsCustomer('081');
    expect(getPointByPhone.execute).toHaveBeenCalledWith(null, '081');
    expect(result).toEqual([]);
  });

  it('getVoucherTransactionsCustomer passes null merchantId', async () => {
    getVoucherByPhone.execute.mockResolvedValue([] as any);
    const result = await controller.getVoucherTransactionsCustomer('081');
    expect(getVoucherByPhone.execute).toHaveBeenCalledWith(null, '081');
    expect(result).toEqual([]);
  });

  it('getTransactionsByMerchantRef parses couponIds and delegates', async () => {
    getByMerchantRef.execute.mockResolvedValue([] as any);
    const result = await controller.getTransactionsByMerchantRef(
      'ref1',
      'REDEEM',
      'c1,c2,c3',
    );
    expect(getByMerchantRef.execute).toHaveBeenCalledWith('ref1', 'REDEEM', [
      'c1',
      'c2',
      'c3',
    ]);
    expect(result).toEqual([]);
  });

  it('getTransactionsByMerchantRef without couponIds passes undefined', async () => {
    getByMerchantRef.execute.mockResolvedValue([] as any);
    await controller.getTransactionsByMerchantRef('ref1', undefined, undefined);
    expect(getByMerchantRef.execute).toHaveBeenCalledWith(
      'ref1',
      undefined,
      undefined,
    );
  });

  it('getTransaction delegates to getTransactionById', async () => {
    getById.execute.mockResolvedValue({ id: 'tx1' } as any);
    const result = await controller.getTransaction('tx1');
    expect(getById.execute).toHaveBeenCalledWith('tx1');
    expect(result).toEqual({ id: 'tx1' });
  });
});
