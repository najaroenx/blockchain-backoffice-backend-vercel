import { StreamableFile } from '@nestjs/common';
import { AdminController } from 'src/modules/internal/admin/controllers/admin.controller';
import { ExportAisLog } from 'src/modules/internal/admin/handlers/export-ais-log.handler';
import { ExportDatabase } from 'src/modules/internal/admin/handlers/export-database.handler';
import { ExportDatabaseSql } from 'src/modules/internal/admin/handlers/export-database-sql.handler';
import { MintTHBToMerchant } from 'src/modules/internal/admin/handlers/mintTHBToMerchant.handler';

describe('AdminController', () => {
  let controller: AdminController;
  let mintHandler: jest.Mocked<MintTHBToMerchant>;
  let exportAisLogHandler: jest.Mocked<ExportAisLog>;
  let exportDatabaseHandler: jest.Mocked<ExportDatabase>;
  let exportDatabaseSqlHandler: jest.Mocked<ExportDatabaseSql>;

  beforeEach(() => {
    mintHandler = { execute: jest.fn() } as any;
    exportAisLogHandler = { execute: jest.fn() } as any;
    exportDatabaseHandler = { execute: jest.fn() } as any;
    exportDatabaseSqlHandler = { execute: jest.fn() } as any;

    controller = new AdminController(
      mintHandler,
      exportAisLogHandler,
      exportDatabaseHandler,
      exportDatabaseSqlHandler,
    );
  });

  it('mintTHBToMerchant delegates to handler', async () => {
    mintHandler.execute.mockResolvedValue({ txHash: '0xabc' } as any);
    const result = await controller.mintTHBToMerchant('m1', 1000);
    expect(mintHandler.execute).toHaveBeenCalledWith('m1', 1000);
    expect(result).toEqual({ txHash: '0xabc' });
  });

  it('exportAisLog sets download headers and returns a streamable file', async () => {
    const fileBuffer = Buffer.from('xlsx-content');
    const setHeader = jest.fn();

    exportAisLogHandler.execute.mockResolvedValue({
      fileBuffer,
      fileName: 'ais-transfer-log-2026-03-01-to-2026-03-09.xlsx',
    });

    const result = await controller.exportAisLog(
      {
        startDate: '2026-03-01',
        endDate: '2026-03-09',
      },
      { setHeader } as any,
    );

    expect(exportAisLogHandler.execute).toHaveBeenCalledWith({
      startDate: '2026-03-01',
      endDate: '2026-03-09',
    });
    expect(setHeader).toHaveBeenNthCalledWith(
      1,
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(setHeader).toHaveBeenNthCalledWith(
      2,
      'Content-Disposition',
      'attachment; filename="ais-transfer-log-2026-03-01-to-2026-03-09.xlsx"',
    );
    expect(result).toBeInstanceOf(StreamableFile);
  });

  it('exportDatabase sets download headers and returns a streamable file', async () => {
    const fileBuffer = Buffer.from('{"ok":true}');
    const setHeader = jest.fn();

    exportDatabaseHandler.execute.mockResolvedValue({
      fileBuffer,
      fileName: 'database-export-2026-03-27T10-00-00-000Z.json',
    });

    const result = await controller.exportDatabase({ setHeader } as any);

    expect(exportDatabaseHandler.execute).toHaveBeenCalledWith();
    expect(setHeader).toHaveBeenNthCalledWith(
      1,
      'Content-Type',
      'application/json',
    );
    expect(setHeader).toHaveBeenNthCalledWith(
      2,
      'Content-Disposition',
      'attachment; filename="database-export-2026-03-27T10-00-00-000Z.json"',
    );
    expect(result).toBeInstanceOf(StreamableFile);
  });

  it('exportDatabaseSql sets download headers and returns a streamable file', async () => {
    const fileBuffer = Buffer.from('BEGIN; COMMIT;');
    const setHeader = jest.fn();

    exportDatabaseSqlHandler.execute.mockResolvedValue({
      fileBuffer,
      fileName: 'database-export-2026-03-27T10-00-00-000Z.sql',
    });

    const result = await controller.exportDatabaseSql({ setHeader } as any);

    expect(exportDatabaseSqlHandler.execute).toHaveBeenCalledWith();
    expect(setHeader).toHaveBeenNthCalledWith(
      1,
      'Content-Type',
      'application/sql',
    );
    expect(setHeader).toHaveBeenNthCalledWith(
      2,
      'Content-Disposition',
      'attachment; filename="database-export-2026-03-27T10-00-00-000Z.sql"',
    );
    expect(result).toBeInstanceOf(StreamableFile);
  });
});
