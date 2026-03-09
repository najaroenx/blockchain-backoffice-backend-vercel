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
    expect(result.fileName).toBe('ais-transfer-log-2026-03-01-to-2026-03-09.xlsx');
    expect(result.fileBuffer).toBeInstanceOf(Buffer);
    expect(result.fileBuffer.length).toBeGreaterThan(0);
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