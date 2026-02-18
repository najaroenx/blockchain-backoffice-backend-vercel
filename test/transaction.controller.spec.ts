jest.mock('prisma/prisma.service', () => ({ PrismaService: jest.fn() }));

import { Test, TestingModule } from '@nestjs/testing';
import { TransactionController } from 'src/modules/internal/transaction/controllers/transaction.controller';
import { GetTransactionsByCustomerId } from 'src/modules/internal/transaction/handlers/getTransactionsByCustomerId.handler';
import { GetTransactionsByMerchantId } from 'src/modules/internal/transaction/handlers/getTransactionsByMerchantId.handler';
import { GetPointTransactionsByCustomerPhone } from 'src/modules/internal/transaction/handlers/getPointTransactionsByCustomerPhone.handler';
import { GetVoucherTransactionsByCustomerPhone } from 'src/modules/internal/transaction/handlers/getVoucherTransactionsByCustomerPhone.handler';
import { CreateTransactionB2C } from 'src/modules/internal/transaction/handlers/createTransactionB2C.handler';
import { GetWalletBalance } from 'src/modules/internal/transaction/handlers/getMerchantBalance.handler';

describe('TransactionController', () => {
  let controller: TransactionController;
  let getTransactionsByCustomerId: jest.Mocked<GetTransactionsByCustomerId>;
  let getTransactionsByMerchantId: jest.Mocked<GetTransactionsByMerchantId>;
  let getPointTransactionsByCustomerPhone: jest.Mocked<GetPointTransactionsByCustomerPhone>;
  let getVoucherTransactionsByCustomerPhone: jest.Mocked<GetVoucherTransactionsByCustomerPhone>;
  let createTransactionB2C: jest.Mocked<CreateTransactionB2C>;
  let getWalletBalance: jest.Mocked<GetWalletBalance>;

  beforeEach(async () => {
    getTransactionsByCustomerId = { executeByCustomerId: jest.fn() } as any;
    getTransactionsByMerchantId = { execute: jest.fn() } as any;
    getPointTransactionsByCustomerPhone = { execute: jest.fn() } as any;
    getVoucherTransactionsByCustomerPhone = { execute: jest.fn() } as any;
    createTransactionB2C = { execute: jest.fn() } as any;
    getWalletBalance = { execute: jest.fn() } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransactionController],
      providers: [
        {
          provide: GetTransactionsByCustomerId,
          useValue: getTransactionsByCustomerId,
        },
        {
          provide: GetTransactionsByMerchantId,
          useValue: getTransactionsByMerchantId,
        },
        {
          provide: GetPointTransactionsByCustomerPhone,
          useValue: getPointTransactionsByCustomerPhone,
        },
        {
          provide: GetVoucherTransactionsByCustomerPhone,
          useValue: getVoucherTransactionsByCustomerPhone,
        },
        { provide: CreateTransactionB2C, useValue: createTransactionB2C },
        { provide: GetWalletBalance, useValue: getWalletBalance },
      ],
    }).compile();

    controller = module.get<TransactionController>(TransactionController);
  });

  it('getTransactions delegates to getTransactionsByMerchantId', async () => {
    getTransactionsByMerchantId.execute.mockResolvedValue([] as any);
    const result = await controller.getTransactions('m1');
    expect(getTransactionsByMerchantId.execute).toHaveBeenCalledWith('m1');
    expect(result).toEqual([]);
  });

  it('getPointTransactionsCustomer delegates to handler', async () => {
    getPointTransactionsByCustomerPhone.execute.mockResolvedValue([
      { id: 'tx1' },
    ] as any);
    const result = await controller.getPointTransactionsCustomer('m1', '081');
    expect(getPointTransactionsByCustomerPhone.execute).toHaveBeenCalledWith(
      'm1',
      '081',
    );
    expect(result).toEqual([{ id: 'tx1' }]);
  });

  it('getVoucherTransactionsCustomer delegates to handler', async () => {
    getVoucherTransactionsByCustomerPhone.execute.mockResolvedValue([
      { id: 'tx2' },
    ] as any);
    const result = await controller.getVoucherTransactionsCustomer('m1', '081');
    expect(getVoucherTransactionsByCustomerPhone.execute).toHaveBeenCalledWith(
      'm1',
      '081',
    );
    expect(result).toEqual([{ id: 'tx2' }]);
  });

  it('getTransactionsByCustomer delegates to executeByCustomerId', async () => {
    getTransactionsByCustomerId.executeByCustomerId.mockResolvedValue(
      [] as any,
    );
    const result = await controller.getTransactionsByCustomer('m1', 'c1');
    expect(
      getTransactionsByCustomerId.executeByCustomerId,
    ).toHaveBeenCalledWith('m1', 'c1');
    expect(result).toEqual([]);
  });

  it('getWalletBalanceForPoint delegates to handler', async () => {
    getWalletBalance.execute.mockResolvedValue({ balance: 100 } as any);
    const result = await controller.getWalletBalanceForPoint('0xabc', 'p1');
    expect(getWalletBalance.execute).toHaveBeenCalledWith('p1', '0xabc');
    expect(result).toEqual({ balance: 100 });
  });

  it('transaction delegates to createTransactionB2C', async () => {
    const body = { amount: 10, phone: '081' } as any;
    createTransactionB2C.execute.mockResolvedValue({ txHash: '0x' } as any);
    const result = await controller.transaction('m1', 'p1', body);
    expect(createTransactionB2C.execute).toHaveBeenCalledWith('m1', 'p1', body);
    expect(result).toEqual({ txHash: '0x' });
  });
});
