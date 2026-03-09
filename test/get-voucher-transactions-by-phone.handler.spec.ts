jest.mock('prisma/prisma.service', () => ({ PrismaService: jest.fn() }));
jest.mock('src/libs/convertBufferToAddress', () => ({
  convertBufferToAddress: jest.fn(
    (buf) => '0x' + Buffer.from(buf).toString('hex'),
  ),
}));

import {
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { GetVoucherTransactionsByCustomerPhone } from 'src/modules/internal/transaction/handlers/getVoucherTransactionsByCustomerPhone.handler';

describe('GetVoucherTransactionsByCustomerPhone', () => {
  let handler: GetVoucherTransactionsByCustomerPhone;
  let db: any;
  let customerDb: any;

  const makeTx = (type: string) => ({
    id: 'tx1',
    txHash: Buffer.from('ab'.repeat(20), 'hex'),
    senderAddress: Buffer.from('cd'.repeat(20), 'hex'),
    receiverAddress: Buffer.from('ef'.repeat(20), 'hex'),
    transactionTypeId: 'REDEEM',
    amount: 1,
    merchantId: 'm1',
    senderId: 'c1',
    receiverId: 'm1',
    eventId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    type,
    senderType: 'CUSTOMER',
    receiverType: 'MERCHANT',
    merchant: { id: 'm1', name: 'Shop', imageUrl: null },
    point: { id: 'p1', name: 'Gold', symbol: 'GLD', merchantId: 'm1' },
    voucherCode: {
      currency: 'THB',
      voucher: {
        id: 'v1',
        tokenId: 't1',
        name: 'Voucher',
        description: 'desc',
        valueType: 'FIXED',
        value: 100,
        currency: 'THB',
        imageUrl: null,
        startDate: null,
        endDate: null,
      },
    },
  });

  beforeEach(() => {
    db = {
      getTransactionsByCustomerId: jest.fn(),
      getAllTransactionsByCustomerId: jest.fn(),
    };
    customerDb = { getCustomerByPhoneDetailed: jest.fn() };
    handler = new GetVoucherTransactionsByCustomerPhone(
      db as any,
      customerDb as any,
    );
  });

  it('returns only VOUCHER transactions', async () => {
    customerDb.getCustomerByPhoneDetailed.mockResolvedValue({ id: 'c1' });
    db.getTransactionsByCustomerId.mockResolvedValue([
      makeTx('VOUCHER'),
      makeTx('POINT'),
    ]);

    const result = await handler.execute('m1', '081');
    expect(result.counts).toBe(1);
    expect(result.transactions[0].voucher).not.toBeNull();
    expect(result.transactions[0].typeAsset).toBe('VOUCHER');
  });

  it('uses getAllTransactionsByCustomerId when merchantId is null', async () => {
    customerDb.getCustomerByPhoneDetailed.mockResolvedValue({ id: 'c1' });
    db.getAllTransactionsByCustomerId.mockResolvedValue([makeTx('VOUCHER')]);

    await handler.execute(null, '081');
    expect(db.getAllTransactionsByCustomerId).toHaveBeenCalledWith('c1');
  });

  it('throws NotFoundException when customer not found', async () => {
    customerDb.getCustomerByPhoneDetailed.mockResolvedValue(null);
    await expect(handler.execute('m1', '081')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('wraps errors in InternalServerErrorException', async () => {
    customerDb.getCustomerByPhoneDetailed.mockRejectedValue(new Error('fail'));
    await expect(handler.execute('m1', '081')).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  it('falls back to voucher seller merchant info when transaction merchant is null', async () => {
    customerDb.getCustomerByPhoneDetailed.mockResolvedValue({ id: 'c1' });
    db.getAllTransactionsByCustomerId.mockResolvedValue([
      {
        ...makeTx('VOUCHER'),
        merchantId: null,
        receiverId: null,
        merchant: null,
        voucherCode: {
          currency: 'THB',
          voucher: {
            id: 'v1',
            sellerMerchantId: 'seller-1',
            merchantId: null,
            merchantName: 'Seller One',
            tokenId: 't1',
            name: 'Voucher',
            description: 'desc',
            valueType: 'FIXED',
            value: 100,
            currency: 'THB',
            imageUrl: null,
            startDate: null,
            endDate: null,
          },
        },
      },
    ]);

    const result = await handler.execute(null, '081');

    expect(result.transactions[0].merchant.id).toBe('seller-1');
    expect(result.transactions[0].merchant.name).toBe('Seller One');
  });
});
