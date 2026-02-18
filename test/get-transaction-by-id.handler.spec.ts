jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));
jest.mock('src/libs/convertBufferToAddress', () => ({
  convertBufferToAddress: jest
    .fn()
    .mockImplementation((buf) =>
      buf ? '0x' + Buffer.from(buf).toString('hex') : '0x',
    ),
}));
import {
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { GetTransactionById } from 'src/modules/internal/transaction/handlers/getTransactionById.handler';
import { TransactionDBService } from 'src/modules/internal/transaction/services/transaction-db.service';
import { PrismaService } from 'prisma/prisma.service';

describe('GetTransactionById', () => {
  let handler: GetTransactionById;
  let dbService: jest.Mocked<TransactionDBService>;
  let prisma: any;

  const mockTransaction = {
    id: 'tx-123',
    txHash: Buffer.from(
      'abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd',
      'hex',
    ),
    senderAddress: Buffer.from(
      '1234567890123456789012345678901234567890',
      'hex',
    ),
    receiverAddress: Buffer.from(
      'abcdefabcdefabcdefabcdefabcdefabcdefabcd',
      'hex',
    ),
    amount: 100,
    merchantId: 'merchant-1',
    pointId: 'point-1',
    senderId: 'merchant-1',
    receiverId: 'customer-1',
    transactionTypeId: 'TRANSFER',
    senderType: 'MERCHANT',
    receiverType: 'CUSTOMER',
    type: 'POINT',
    eventId: null,
    transactionRefId: 'ref-1',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    merchant: { id: 'merchant-1', name: 'Test Merchant', imageUrl: null },
    point: {
      id: 'point-1',
      name: 'Test Points',
      symbol: 'TST',
      merchantId: 'merchant-1',
      imageUrl: null,
    },
    voucherCode: null,
  };

  beforeEach(() => {
    dbService = {
      getTransactionById: jest.fn(),
    } as any;

    prisma = {
      customer: { findUnique: jest.fn() },
      merchant: { findUnique: jest.fn() },
    };

    handler = new GetTransactionById(dbService, prisma as any);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should return formatted transaction when found', async () => {
    dbService.getTransactionById.mockResolvedValue(mockTransaction as any);
    prisma.merchant.findUnique.mockResolvedValue({ name: 'Test Merchant' });
    prisma.customer.findUnique.mockResolvedValue({ tel: '0812345678' });

    const result = await handler.execute('tx-123');

    expect(dbService.getTransactionById).toHaveBeenCalledWith('tx-123');
    expect(result.id).toBe('tx-123');
    expect(result.amount).toBe(100);
    expect(result.merchant.name).toBe('Test Merchant');
    expect(result.point).not.toBeNull();
  });

  it('should throw NotFoundException when transaction not found', async () => {
    dbService.getTransactionById.mockResolvedValue(null);

    await expect(handler.execute('nonexistent')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should throw InternalServerErrorException on DB error', async () => {
    dbService.getTransactionById.mockRejectedValue(new Error('DB failed'));

    await expect(handler.execute('tx-123')).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  it('should return null voucher for POINT type transactions', async () => {
    dbService.getTransactionById.mockResolvedValue(mockTransaction as any);
    prisma.merchant.findUnique.mockResolvedValue({ name: 'Merchant' });
    prisma.customer.findUnique.mockResolvedValue({ tel: '0812345678' });

    const result = await handler.execute('tx-123');

    expect(result.voucher).toBeNull();
  });

  it('should return voucher info for VOUCHER type transactions', async () => {
    const voucherTx = {
      ...mockTransaction,
      type: 'VOUCHER',
      voucherCode: {
        id: 'code-1',
        currency: 'POINTS',
        voucher: {
          id: 'voucher-1',
          tokenId: '1',
          name: 'Test Voucher',
          description: 'Desc',
          valueType: 'cash',
          value: 50,
          currency: 'THB',
          imageUrl: null,
          startDate: null,
          endDate: null,
        },
      },
    };
    dbService.getTransactionById.mockResolvedValue(voucherTx as any);
    prisma.merchant.findUnique.mockResolvedValue({ name: 'Merchant' });
    prisma.customer.findUnique.mockResolvedValue({ tel: '0812345678' });

    const result = await handler.execute('tx-123');

    expect(result.voucher).not.toBeNull();
    expect(result.voucher!.name).toBe('Test Voucher');
  });
});
