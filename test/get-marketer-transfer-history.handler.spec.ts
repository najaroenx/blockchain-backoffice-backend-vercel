jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GetMarketerTransferHistoryHandler } from '../src/modules/internal/voucher/handlers/getMarketerTransferHistory.handler';
import { PrismaService } from 'prisma/prisma.service';

describe('GetMarketerTransferHistoryHandler', () => {
  let handler: GetMarketerTransferHistoryHandler;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      merchant: { findUnique: jest.fn() },
      batchTransferLog: {
        count: jest.fn(),
        findMany: jest.fn(),
      },
    };
    handler = new GetMarketerTransferHistoryHandler(
      prisma as unknown as PrismaService,
    );
  });

  const merchantId = 'merchant-1';

  it('should throw BadRequestException when merchantId is empty', async () => {
    await expect(handler.execute('')).rejects.toThrow(BadRequestException);
  });

  it('should throw NotFoundException when merchant not found', async () => {
    prisma.merchant.findUnique.mockResolvedValue(null);

    await expect(handler.execute(merchantId)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should return paginated transfer history', async () => {
    prisma.merchant.findUnique.mockResolvedValue({ id: merchantId });
    prisma.batchTransferLog.count.mockResolvedValue(2);

    const createdAt = new Date('2024-01-01T00:00:00.000Z');
    prisma.batchTransferLog.findMany.mockResolvedValue([
      {
        id: 'job-1',
        fileName: 'transfers.csv',
        status: 'COMPLETED',
        totalRecords: 10,
        successfulCount: 8,
        failedCount: 2,
        createdAt,
        details: [{ row: 1, error: 'Not found' }],
      },
      {
        id: 'job-2',
        fileName: 'batch2.csv',
        status: 'FAILED',
        totalRecords: 5,
        successfulCount: 0,
        failedCount: 5,
        createdAt,
        details: null,
      },
    ]);

    const result = await handler.execute(merchantId, 1, 10);

    expect(result.summary).toEqual({ page: 1, limit: 10, totalRecords: 2 });
    expect(result.history).toHaveLength(2);
    expect(result.history[0]).toMatchObject({
      batchJobId: 'job-1',
      fileName: 'transfers.csv',
      status: 'COMPLETED',
      totalRecords: 10,
      successfulCount: 8,
      failedCount: 2,
      createdAt: createdAt.toISOString(),
      details: [{ row: 1, error: 'Not found' }],
    });
    expect(result.history[1].details).toEqual([]);
  });

  it('should use defaults when page and limit are not provided', async () => {
    prisma.merchant.findUnique.mockResolvedValue({ id: merchantId });
    prisma.batchTransferLog.count.mockResolvedValue(0);
    prisma.batchTransferLog.findMany.mockResolvedValue([]);

    const result = await handler.execute(merchantId);

    expect(result.summary).toEqual({ page: 1, limit: 10, totalRecords: 0 });
    expect(prisma.batchTransferLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10, skip: 0 }),
    );
  });

  it('should clamp invalid page and limit to 1 and 10', async () => {
    prisma.merchant.findUnique.mockResolvedValue({ id: merchantId });
    prisma.batchTransferLog.count.mockResolvedValue(0);
    prisma.batchTransferLog.findMany.mockResolvedValue([]);

    const result = await handler.execute(merchantId, 0, 0);

    expect(result.summary.page).toBe(1);
    expect(result.summary.limit).toBe(10);
  });

  it('should calculate correct skip for page 2 with limit 5', async () => {
    prisma.merchant.findUnique.mockResolvedValue({ id: merchantId });
    prisma.batchTransferLog.count.mockResolvedValue(10);
    prisma.batchTransferLog.findMany.mockResolvedValue([]);

    await handler.execute(merchantId, 2, 5);

    expect(prisma.batchTransferLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 5, skip: 5 }),
    );
  });

  it('should pass merchantId filter to DB queries', async () => {
    prisma.merchant.findUnique.mockResolvedValue({ id: merchantId });
    prisma.batchTransferLog.count.mockResolvedValue(0);
    prisma.batchTransferLog.findMany.mockResolvedValue([]);

    await handler.execute(merchantId, 1, 10);

    expect(prisma.batchTransferLog.count).toHaveBeenCalledWith({
      where: { merchantId },
    });
    expect(prisma.batchTransferLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { merchantId } }),
    );
  });
});
