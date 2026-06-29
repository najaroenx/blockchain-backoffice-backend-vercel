jest.mock('prisma/prisma.service', () => ({ PrismaService: jest.fn() }));

import { InternalServerErrorException } from '@nestjs/common';
import { DeleteVoucherCascade } from 'src/modules/internal/admin/handlers/delete-voucher-cascade.handler';

describe('DeleteVoucherCascade', () => {
  let handler: DeleteVoucherCascade;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      $transaction: jest.fn(),
    };
    handler = new DeleteVoucherCascade(mockPrisma);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should cascade delete transactions, voucherCodes, and vouchers', async () => {
    const mockTxResult = {
      deletedTransactions: 10,
      deletedVoucherCodes: 5,
      deletedVouchers: 3,
    };

    mockPrisma.$transaction.mockImplementation(async (cb: Function) => {
      const tx = {
        transaction: {
          deleteMany: jest.fn().mockResolvedValue({ count: 10 }),
        },
        voucherCode: {
          deleteMany: jest.fn().mockResolvedValue({ count: 5 }),
        },
        voucher: {
          deleteMany: jest.fn().mockResolvedValue({ count: 3 }),
        },
      };
      return cb(tx);
    });

    const result = await handler.execute();

    expect(result).toEqual({
      success: true,
      message: 'Transaction, voucherCode, and voucher data deleted successfully',
      ...mockTxResult,
    });
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('should delete in correct order: transactions first, then voucherCodes, then vouchers', async () => {
    const callOrder: string[] = [];

    mockPrisma.$transaction.mockImplementation(async (cb: Function) => {
      const tx = {
        transaction: {
          deleteMany: jest.fn().mockImplementation(() => {
            callOrder.push('transaction');
            return { count: 0 };
          }),
        },
        voucherCode: {
          deleteMany: jest.fn().mockImplementation(() => {
            callOrder.push('voucherCode');
            return { count: 0 };
          }),
        },
        voucher: {
          deleteMany: jest.fn().mockImplementation(() => {
            callOrder.push('voucher');
            return { count: 0 };
          }),
        },
      };
      return cb(tx);
    });

    await handler.execute();

    expect(callOrder).toEqual(['transaction', 'voucherCode', 'voucher']);
  });

  it('should throw InternalServerErrorException on error', async () => {
    mockPrisma.$transaction.mockRejectedValue(new Error('DB error'));

    await expect(handler.execute()).rejects.toThrow(InternalServerErrorException);
  });

  it('should return zero counts when tables are empty', async () => {
    mockPrisma.$transaction.mockImplementation(async (cb: Function) => {
      const tx = {
        transaction: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
        voucherCode: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
        voucher: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      };
      return cb(tx);
    });

    const result = await handler.execute();

    expect(result.deletedTransactions).toBe(0);
    expect(result.deletedVoucherCodes).toBe(0);
    expect(result.deletedVouchers).toBe(0);
    expect(result.success).toBe(true);
  });
});
