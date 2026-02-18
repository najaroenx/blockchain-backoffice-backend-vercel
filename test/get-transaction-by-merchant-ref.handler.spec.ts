jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));
jest.mock('src/libs/convertBufferToAddress', () => ({
  convertBufferToAddress: jest.fn(
    (buf) => '0x' + Buffer.from(buf || []).toString('hex'),
  ),
}));

import {
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { GetTransactionByMerchantRef } from 'src/modules/internal/transaction/handlers/getTransactionByMerchantRef.handler';

describe('GetTransactionByMerchantRef', () => {
  let handler: GetTransactionByMerchantRef;
  let mockDb: any;
  let mockPrisma: any;
  let mockMerchantRefEnrichment: any;

  beforeEach(() => {
    mockDb = {
      getTransactionsByMerchantRef: jest.fn(),
    };
    mockPrisma = {
      customer: { findUnique: jest.fn() },
      merchant: { findUnique: jest.fn() },
    };
    mockMerchantRefEnrichment = {
      enrich: jest.fn().mockResolvedValue({ name: 'Store', branchId: 'b1' }),
    };
    handler = new GetTransactionByMerchantRef(
      mockDb as any,
      mockPrisma as any,
      mockMerchantRefEnrichment as any,
    );
  });

  it('should throw NotFoundException when no transactions found', async () => {
    mockDb.getTransactionsByMerchantRef.mockResolvedValue([]);
    await expect(handler.execute('ref1')).rejects.toThrow(NotFoundException);
  });

  it('should throw NotFoundException when null transactions', async () => {
    mockDb.getTransactionsByMerchantRef.mockResolvedValue(null);
    await expect(handler.execute('ref1')).rejects.toThrow(NotFoundException);
  });

  it('should format and return transaction details', async () => {
    mockDb.getTransactionsByMerchantRef.mockResolvedValue([
      {
        id: 'tx1',
        txHash: Buffer.from('abc', 'hex'),
        senderAddress: Buffer.from('sender', 'hex'),
        receiverAddress: Buffer.from('receiver', 'hex'),
        transactionTypeId: 'REDEEM',
        amount: 1,
        senderId: 'c1',
        receiverId: 'm1',
        senderType: 'CUSTOMER',
        receiverType: 'MERCHANT',
        merchantId: 'm1',
        type: 'VOUCHER',
        eventId: null,
        transactionRefId: 'tr1',
        createdAt: new Date(),
        updatedAt: new Date(),
        merchant: { name: 'TestMerchant', imageUrl: null },
        point: null,
        voucherCode: {
          currency: 'THB',
          voucher: {
            id: 'v1',
            tokenId: '1',
            name: 'Voucher',
            description: 'D',
            valueType: 'fixed',
            value: 100,
            currency: 'THB',
            imageUrl: null,
            startDate: null,
            endDate: null,
          },
        },
      },
    ]);
    mockPrisma.customer.findUnique.mockResolvedValue({ tel: '0812345678' });
    mockPrisma.merchant.findUnique.mockResolvedValue({ name: 'TestMerchant' });

    const result = await handler.execute('ref1');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('tx1');
    expect(result[0].voucher).not.toBeNull();
    expect(result[0].voucher?.merchantRefDetail).toBeDefined();
  });

  it('should handle POINT type transactions (no voucher info)', async () => {
    mockDb.getTransactionsByMerchantRef.mockResolvedValue([
      {
        id: 'tx2',
        txHash: Buffer.from('def', 'hex'),
        senderAddress: Buffer.from('s', 'hex'),
        receiverAddress: Buffer.from('r', 'hex'),
        transactionTypeId: 'TRANSFER',
        amount: 500,
        senderId: 'm1',
        receiverId: 'c1',
        senderType: 'MERCHANT',
        receiverType: 'CUSTOMER',
        merchantId: 'm1',
        type: 'POINT',
        eventId: null,
        transactionRefId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        merchant: { name: 'M', imageUrl: null },
        point: {
          id: 'p1',
          name: 'Points',
          symbol: 'PTS',
          merchantId: 'm1',
          imageUrl: null,
        },
        voucherCode: null,
      },
    ]);
    mockPrisma.merchant.findUnique.mockResolvedValue({ name: 'M' });
    mockPrisma.customer.findUnique.mockResolvedValue({ tel: '0899999999' });

    const result = await handler.execute('ref1');
    expect(result[0].voucher).toBeNull();
    expect(result[0].point).not.toBeNull();
    expect(result[0].point?.symbol).toBe('PTS');
  });

  it('should pass status and couponIds to DB query', async () => {
    mockDb.getTransactionsByMerchantRef.mockResolvedValue([
      {
        id: 'tx1',
        txHash: Buffer.from('a', 'hex'),
        senderAddress: Buffer.from('s', 'hex'),
        receiverAddress: Buffer.from('r', 'hex'),
        transactionTypeId: 'REDEEM',
        amount: 1,
        senderId: 'c1',
        receiverId: 'm1',
        senderType: 'CUSTOMER',
        receiverType: 'MERCHANT',
        merchantId: 'm1',
        type: 'VOUCHER',
        eventId: null,
        transactionRefId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        merchant: { name: 'M', imageUrl: null },
        point: null,
        voucherCode: {
          currency: 'T',
          voucher: {
            id: 'v1',
            tokenId: null,
            name: 'V',
            description: null,
            valueType: 'fixed',
            value: 1,
            currency: 'T',
            imageUrl: null,
            startDate: null,
            endDate: null,
          },
        },
      },
    ]);
    mockPrisma.customer.findUnique.mockResolvedValue({ tel: '0800000000' });

    await handler.execute('ref1', 'completed', ['coupon1']);
    expect(mockDb.getTransactionsByMerchantRef).toHaveBeenCalledWith(
      'ref1',
      'completed',
      ['coupon1'],
    );
  });

  it('should throw InternalServerErrorException on unexpected error', async () => {
    mockDb.getTransactionsByMerchantRef.mockRejectedValue(
      new Error('DB crash'),
    );
    await expect(handler.execute('ref1')).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  it('should handle empty display names for participants', async () => {
    mockDb.getTransactionsByMerchantRef.mockResolvedValue([
      {
        id: 'tx1',
        txHash: Buffer.from('a', 'hex'),
        senderAddress: Buffer.from('s', 'hex'),
        receiverAddress: Buffer.from('r', 'hex'),
        transactionTypeId: 'T',
        amount: 1,
        senderId: null,
        receiverId: null,
        senderType: null,
        receiverType: null,
        merchantId: 'm1',
        type: 'POINT',
        eventId: null,
        transactionRefId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        merchant: { name: 'M', imageUrl: null },
        point: {
          id: 'p1',
          name: 'P',
          symbol: 'P',
          merchantId: 'm1',
          imageUrl: null,
        },
        voucherCode: null,
      },
    ]);

    const result = await handler.execute('ref1');
    expect(result[0].sender.displayName).toBe('');
    expect(result[0].receiver.displayName).toBe('');
  });
});
