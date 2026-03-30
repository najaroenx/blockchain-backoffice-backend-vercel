jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import { InternalServerErrorException } from '@nestjs/common';
import { ResetVoucherTokenIds } from 'src/modules/internal/admin/handlers/reset-voucher-token-ids.handler';

describe('ResetVoucherTokenIds', () => {
  let handler: ResetVoucherTokenIds;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn(),
    };

    handler = new ResetVoucherTokenIds(prisma);
  });

  it('should reset voucher tokenIds sequentially starting from 10000', async () => {
    const tx = {
      voucher: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'v1' }, { id: 'v2' }, { id: 'v3' }]),
        updateMany: jest.fn().mockResolvedValue({ count: 3 }),
        update: jest.fn().mockResolvedValue(undefined),
      },
    };

    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback(tx),
    );

    const result = await handler.execute();

    expect(tx.voucher.findMany).toHaveBeenCalledWith({
      select: { id: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    expect(tx.voucher.updateMany).toHaveBeenCalledWith({
      data: { tokenId: null },
    });
    expect(tx.voucher.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'v1' },
      data: { tokenId: '10000' },
    });
    expect(tx.voucher.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'v2' },
      data: { tokenId: '10001' },
    });
    expect(tx.voucher.update).toHaveBeenNthCalledWith(3, {
      where: { id: 'v3' },
      data: { tokenId: '10002' },
    });
    expect(result).toEqual({
      success: true,
      message: 'All voucher tokenId values have been reset successfully',
      updatedCount: 3,
      startTokenId: '10000',
      endTokenId: '10002',
    });
  });

  it('should return empty range when no vouchers exist', async () => {
    const tx = {
      voucher: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn(),
        update: jest.fn(),
      },
    };

    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback(tx),
    );

    const result = await handler.execute();

    expect(tx.voucher.updateMany).not.toHaveBeenCalled();
    expect(tx.voucher.update).not.toHaveBeenCalled();
    expect(result).toEqual({
      success: true,
      message: 'All voucher tokenId values have been reset successfully',
      updatedCount: 0,
      startTokenId: null,
      endTokenId: null,
    });
  });

  it('should throw InternalServerErrorException on failure', async () => {
    prisma.$transaction.mockRejectedValue(new Error('db error'));

    await expect(handler.execute()).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });
});
