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
import { GetAllTransactionsByCustomerPhone } from 'src/modules/internal/transaction/handlers/getAllTransactionsByCustomerPhone.handler';

describe('GetAllTransactionsByCustomerPhone', () => {
  let handler: GetAllTransactionsByCustomerPhone;
  let db: any;
  let customerDb: any;
  let prisma: any;

  const makeTx = (type: string, createdAt: Date) => ({
    id: `tx-${type}`,
    txHash: Buffer.from('ab'.repeat(20), 'hex'),
    senderAddress: Buffer.from('cd'.repeat(20), 'hex'),
    receiverAddress: Buffer.from('ef'.repeat(20), 'hex'),
    transactionTypeId: 'TRANSFER',
    amount: 100,
    merchantId: 'm1',
    senderId: 'c1',
    receiverId: 'c2',
    eventId: null,
    createdAt,
    updatedAt: createdAt,
    type,
    senderType: 'CUSTOMER',
    receiverType: 'MERCHANT',
    merchant: { id: 'm1', name: 'Shop', imageUrl: null },
    point: { id: 'p1', name: 'Gold', symbol: 'GLD', merchantId: 'm1' },
    voucherCode:
      type === 'VOUCHER'
        ? {
            currency: 'THB',
            voucher: {
              id: 'v1',
              tokenId: 't1',
              name: 'V',
              description: null,
              valueType: 'FIXED',
              value: 100,
              currency: 'THB',
              imageUrl: null,
              startDate: null,
              endDate: null,
            },
          }
        : null,
  });

  beforeEach(() => {
    db = { getAllTransactionsByCustomerId: jest.fn() };
    customerDb = { getCustomerByPhoneDetailed: jest.fn() };
    prisma = {
      customer: { findUnique: jest.fn() },
      merchant: { findUnique: jest.fn() },
    };
    handler = new GetAllTransactionsByCustomerPhone(
      db as any,
      customerDb as any,
      prisma as any,
    );
  });

  it('returns all transactions sorted by date desc, VOUCHER before POINT for same date', async () => {
    const date = new Date('2024-06-01');
    customerDb.getCustomerByPhoneDetailed.mockResolvedValue({ id: 'c1' });
    db.getAllTransactionsByCustomerId.mockResolvedValue([
      makeTx('POINT', date),
      makeTx('VOUCHER', date),
    ]);
    prisma.customer.findUnique.mockResolvedValue({ tel: '081' });
    prisma.merchant.findUnique.mockResolvedValue({ name: 'Shop' });

    const result = await handler.execute('081');
    expect(result.counts).toBe(2);
    // VOUCHER should come before POINT when same date
    expect(result.transactions[0].typeAsset).toBe('VOUCHER');
    expect(result.transactions[1].typeAsset).toBe('POINT');
  });

  it('throws NotFoundException when customer not found', async () => {
    customerDb.getCustomerByPhoneDetailed.mockResolvedValue(null);
    await expect(handler.execute('081')).rejects.toThrow(NotFoundException);
  });

  it('wraps generic errors in InternalServerErrorException', async () => {
    customerDb.getCustomerByPhoneDetailed.mockRejectedValue(new Error('fail'));
    await expect(handler.execute('081')).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  it('resolves displayName for CUSTOMER type via prisma lookup', async () => {
    const date = new Date('2024-06-01');
    customerDb.getCustomerByPhoneDetailed.mockResolvedValue({ id: 'c1' });
    db.getAllTransactionsByCustomerId.mockResolvedValue([
      makeTx('POINT', date),
    ]);
    prisma.customer.findUnique.mockResolvedValue({ tel: '0812345678' });
    prisma.merchant.findUnique.mockResolvedValue(null);

    const result = await handler.execute('081');
    expect(result.transactions[0].sender.displayName).toBe('0812345678');
  });
});
