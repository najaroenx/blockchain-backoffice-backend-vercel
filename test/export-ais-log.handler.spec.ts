import { ServiceUnavailableException } from '@nestjs/common';
import { ExportAisLog } from 'src/modules/internal/admin/handlers/export-ais-log.handler';
import { PrismaService } from 'prisma/prisma.service';

describe('ExportAisLog', () => {
  let handler: ExportAisLog;
  let prisma: {
    aisTransferLog: {
      findMany: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      aisTransferLog: {
        findMany: jest.fn(),
      },
    };

    handler = new ExportAisLog(prisma as unknown as PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('exports an xlsx file even when there are no rows', async () => {
    prisma.aisTransferLog.findMany.mockResolvedValue([]);

    const result = await handler.execute({
      startDate: '2026-03-01',
      endDate: '2026-03-09',
    });

    expect(prisma.aisTransferLog.findMany).toHaveBeenCalled();
    expect(result.fileName).toBe(
      'ais-transfer-log-2026-03-01-to-2026-03-09.xlsx',
    );
    expect(result.fileBuffer).toBeInstanceOf(Buffer);
    expect(result.fileBuffer.length).toBeGreaterThan(0);
  });

  it('exports Created At in Thailand time (UTC+7)', async () => {
    const row = (handler as any).mapLogRow({
      id: 'log-1',
      transactionID: 'txn-1',
      action: 'TRANSFER_IN',
      url: 'https://ais.example.com/transfer-in',
      requestBody: Buffer.from(JSON.stringify({ foo: 'bar' })),
      responseBody: Buffer.from(JSON.stringify({ status: '20000' })),
      httpStatus: 200,
      success: true,
      errorMessage: null,
      msisdn: '0899999999',
      points: 40,
      createdAt: new Date('2026-03-11T05:16:17.044Z'),
    });

    expect(row.createdAt).toBe('2026-03-11 12:16:17');
  });

  it('throws a service unavailable error when the AisTransferLog table is missing', async () => {
    prisma.aisTransferLog.findMany.mockRejectedValue({
      code: 'P2021',
      message:
        'The table `public.AisTransferLog` does not exist in the current database.',
    });

    await expect(
      handler.execute({
        startDate: '2026-03-01',
        endDate: '2026-03-09',
      }),
    ).rejects.toThrow(ServiceUnavailableException);
  });
});
