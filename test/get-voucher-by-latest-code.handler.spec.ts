jest.mock('prisma/prisma.service', () => ({ PrismaService: jest.fn() }));

import {
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { GetVoucherById } from 'src/modules/internal/voucher/handlers/getVoucherById.handler';
import { GetVoucherByLatestCode } from 'src/modules/internal/voucher/handlers/getVoucherByLatestCode.handler';

describe('GetVoucherByLatestCode', () => {
  let handler: GetVoucherByLatestCode;
  let prisma: {
    voucherCode: {
      findUnique: jest.Mock;
    };
  };
  let getVoucherById: {
    execute: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      voucherCode: {
        findUnique: jest.fn(),
      },
    };

    getVoucherById = {
      execute: jest.fn(),
    };

    handler = new GetVoucherByLatestCode(
      prisma as any,
      getVoucherById as unknown as GetVoucherById,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should resolve voucher id from code and delegate to GetVoucherById', async () => {
    const queriedCode = {
      id: 'code-1',
      code: '8-BATCH-cmmcyastl005pzw010strv1uu-12-15',
      pointsCost: 250,
      currency: 'POINT',
      isUsed: false,
      usedAt: null,
      usedBy: null,
      currentOwnerId: 'customer-1',
      createdAt: new Date('2026-03-10T10:00:00.000Z'),
      voucherId: 'voucher-1',
    };
    const mockVoucher = {
      id: 'voucher-1',
      totalCodes: 2,
      latestCode: {
        id: 'code-2',
        code: 'newer-code',
        isUsed: true,
      },
    };

    prisma.voucherCode.findUnique.mockResolvedValue(queriedCode);
    getVoucherById.execute.mockResolvedValue(mockVoucher);

    const result = await handler.execute(
      '8-BATCH-cmmcyastl005pzw010strv1uu-12-15',
      'unused',
    );

    expect(prisma.voucherCode.findUnique).toHaveBeenCalledWith({
      where: { code: '8-BATCH-cmmcyastl005pzw010strv1uu-12-15' },
      select: {
        id: true,
        code: true,
        pointsCost: true,
        currency: true,
        isUsed: true,
        usedAt: true,
        usedBy: true,
        currentOwnerId: true,
        createdAt: true,
        voucherId: true,
      },
    });
    expect(getVoucherById.execute).toHaveBeenCalledWith('voucher-1', 'unused');
    expect(result).toEqual({
      ...mockVoucher,
      latestCode: {
        id: queriedCode.id,
        code: queriedCode.code,
        pointsCost: queriedCode.pointsCost,
        currency: queriedCode.currency,
        isUsed: queriedCode.isUsed,
        usedAt: queriedCode.usedAt,
        usedBy: queriedCode.usedBy,
        currentOwnerId: queriedCode.currentOwnerId,
        createdAt: queriedCode.createdAt,
      },
    });
  });

  it('should preserve voucher aggregates while overriding mismatched latestCode with the queried code', async () => {
    const queriedCode = {
      id: 'code-1',
      code: 'requested-code',
      pointsCost: 100,
      currency: 'POINT',
      isUsed: false,
      usedAt: null,
      usedBy: null,
      currentOwnerId: 'customer-42',
      createdAt: new Date('2026-03-09T10:00:00.000Z'),
      voucherId: 'voucher-1',
    };
    const aggregateVoucher = {
      id: 'voucher-1',
      name: 'Voucher A',
      totalCodes: 7,
      totalRedeemed: 3,
      merchantRefDetail: { merchantRef: 'STORE-1' },
      latestCode: {
        id: 'code-2',
        code: 'newest-code-on-voucher',
        pointsCost: 999,
        currency: 'POINT',
        isUsed: true,
        usedAt: new Date('2026-03-11T10:00:00.000Z'),
        usedBy: 'customer-99',
        currentOwnerId: 'customer-99',
        createdAt: new Date('2026-03-11T09:00:00.000Z'),
      },
    };

    prisma.voucherCode.findUnique.mockResolvedValue(queriedCode);
    getVoucherById.execute.mockResolvedValue(aggregateVoucher);

    const result = await handler.execute('requested-code');

    expect(result).toEqual({
      ...aggregateVoucher,
      latestCode: {
        id: 'code-1',
        code: 'requested-code',
        pointsCost: 100,
        currency: 'POINT',
        isUsed: false,
        usedAt: null,
        usedBy: null,
        currentOwnerId: 'customer-42',
        createdAt: new Date('2026-03-09T10:00:00.000Z'),
      },
    });
  });

  it('should throw NotFoundException when code does not exist', async () => {
    prisma.voucherCode.findUnique.mockResolvedValue(null);

    await expect(handler.execute('missing-code')).rejects.toThrow(
      NotFoundException,
    );
    expect(getVoucherById.execute).not.toHaveBeenCalled();
  });

  it('should rethrow InternalServerErrorException from delegated handler', async () => {
    prisma.voucherCode.findUnique.mockResolvedValue({
      id: 'code-1',
      code: 'valid-code',
      pointsCost: 100,
      currency: 'POINT',
      isUsed: false,
      usedAt: null,
      usedBy: null,
      currentOwnerId: 'customer-1',
      createdAt: new Date('2026-03-10T10:00:00.000Z'),
      voucherId: 'voucher-1',
    });
    getVoucherById.execute.mockRejectedValue(
      new InternalServerErrorException('boom'),
    );

    await expect(handler.execute('valid-code')).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  it('should normalize unexpected errors to InternalServerErrorException', async () => {
    prisma.voucherCode.findUnique.mockRejectedValue(new Error('db down'));

    await expect(handler.execute('valid-code')).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
