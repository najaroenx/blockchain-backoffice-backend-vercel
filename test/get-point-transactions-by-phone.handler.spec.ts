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
import { GetPointTransactionsByCustomerPhone } from 'src/modules/internal/transaction/handlers/getPointTransactionsByCustomerPhone.handler';

describe('GetPointTransactionsByCustomerPhone', () => {
  let handler: GetPointTransactionsByCustomerPhone;
  let db: any;
  let customerDb: any;

  const mockTransaction = (type: string, senderId = 'c1') => ({
    id: 'tx1',
    txHash: Buffer.from('ab'.repeat(20), 'hex'),
    senderAddress: Buffer.from('cd'.repeat(20), 'hex'),
    receiverAddress: Buffer.from('ef'.repeat(20), 'hex'),
    transactionTypeId: 'TRANSFER',
    amount: 100,
    merchantId: 'm1',
    senderId,
    receiverId: 'c2',
    eventId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    type,
    senderType: 'MERCHANT',
    receiverType: 'CUSTOMER',
    merchant: { id: 'm1', name: 'Shop', imageUrl: null },
    point: {
      id: 'p1',
      name: 'Gold',
      symbol: 'GLD',
      merchantId: 'm1',
      imageUrl: null,
    },
    voucherCode: null,
  });

  beforeEach(() => {
    db = {
      getTransactionsByCustomerId: jest.fn(),
      getAllTransactionsByCustomerId: jest.fn(),
    };
    customerDb = {
      getCustomerByPhoneDetailed: jest.fn(),
    };
    handler = new GetPointTransactionsByCustomerPhone(
      db as any,
      customerDb as any,
    );
  });

  it('returns only POINT transactions filtered from all', async () => {
    customerDb.getCustomerByPhoneDetailed.mockResolvedValue({ id: 'c1' });
    db.getTransactionsByCustomerId.mockResolvedValue([
      mockTransaction('POINT'),
      mockTransaction('VOUCHER'),
    ]);

    const result = await handler.execute('m1', '081');
    expect(result.counts).toBe(1);
    expect(result.transactions[0].typeAsset).toBe('POINT');
  });

  it('uses getAllTransactionsByCustomerId when merchantId is null', async () => {
    customerDb.getCustomerByPhoneDetailed.mockResolvedValue({ id: 'c1' });
    db.getAllTransactionsByCustomerId.mockResolvedValue([
      mockTransaction('POINT'),
    ]);

    const result = await handler.execute(null, '081');
    expect(db.getAllTransactionsByCustomerId).toHaveBeenCalledWith('c1');
    expect(result.counts).toBe(1);
  });

  it('throws NotFoundException when customer not found', async () => {
    customerDb.getCustomerByPhoneDetailed.mockResolvedValue(null);
    await expect(handler.execute('m1', '081')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('wraps generic errors in InternalServerErrorException', async () => {
    customerDb.getCustomerByPhoneDetailed.mockRejectedValue(new Error('fail'));
    await expect(handler.execute('m1', '081')).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  it('sets transactionDirection SENT when senderId matches customer', async () => {
    customerDb.getCustomerByPhoneDetailed.mockResolvedValue({ id: 'c1' });
    db.getTransactionsByCustomerId.mockResolvedValue([
      mockTransaction('POINT', 'c1'),
    ]);

    const result = await handler.execute('m1', '081');
    expect(result.transactions[0].transactionDirection).toBe('SENT');
  });

  it('sets transactionDirection RECEIVED when senderId is different', async () => {
    customerDb.getCustomerByPhoneDetailed.mockResolvedValue({ id: 'c1' });
    db.getTransactionsByCustomerId.mockResolvedValue([
      mockTransaction('POINT', 'other'),
    ]);

    const result = await handler.execute('m1', '081');
    expect(result.transactions[0].transactionDirection).toBe('RECEIVED');
  });
});
