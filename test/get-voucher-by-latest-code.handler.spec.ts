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
    const mockVoucher = {
      id: 'voucher-1',
      latestCode: {
        code: '8-BATCH-cmmcyastl005pzw010strv1uu-12-15',
      },
    };

    prisma.voucherCode.findUnique.mockResolvedValue({
      voucherId: 'voucher-1',
    });
    getVoucherById.execute.mockResolvedValue(mockVoucher);

    const result = await handler.execute(
      '8-BATCH-cmmcyastl005pzw010strv1uu-12-15',
      'unused',
    );

    expect(prisma.voucherCode.findUnique).toHaveBeenCalledWith({
      where: { code: '8-BATCH-cmmcyastl005pzw010strv1uu-12-15' },
      select: { voucherId: true },
    });
    expect(getVoucherById.execute).toHaveBeenCalledWith('voucher-1', 'unused');
    expect(result).toEqual(mockVoucher);
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