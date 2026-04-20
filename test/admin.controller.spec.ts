import { StreamableFile } from '@nestjs/common';
import { AdminController } from 'src/modules/internal/admin/controllers/admin.controller';
import { ExportAisLog } from 'src/modules/internal/admin/handlers/export-ais-log.handler';
import { ExportDatabase } from 'src/modules/internal/admin/handlers/export-database.handler';
import { ExportDatabaseSql } from 'src/modules/internal/admin/handlers/export-database-sql.handler';
import { ListAllPoints } from 'src/modules/internal/admin/handlers/list-all-points.handler';
import { MintTHBToMerchant } from 'src/modules/internal/admin/handlers/mintTHBToMerchant.handler';
import { ResetCustomerPointBalances } from 'src/modules/internal/admin/handlers/reset-customer-point-balances.handler';
import { ResetVoucherTokenIds } from 'src/modules/internal/admin/handlers/reset-voucher-token-ids.handler';
import { UpdatePointContractAddress } from 'src/modules/internal/admin/handlers/update-point-contract-address.handler';
import { DeleteVoucherCascade } from 'src/modules/internal/admin/handlers/delete-voucher-cascade.handler';
import { describe } from 'node:test';

describe('AdminController', () => {
  let controller: AdminController;
  let mintHandler: jest.Mocked<MintTHBToMerchant>;
  let exportAisLogHandler: jest.Mocked<ExportAisLog>;
  let exportDatabaseHandler: jest.Mocked<ExportDatabase>;
  let exportDatabaseSqlHandler: jest.Mocked<ExportDatabaseSql>;
  let listAllPointsHandler: jest.Mocked<ListAllPoints>;
  let resetCustomerPointBalancesHandler: jest.Mocked<ResetCustomerPointBalances>;
  let resetVoucherTokenIdsHandler: jest.Mocked<ResetVoucherTokenIds>;
  let updatePointContractAddressHandler: jest.Mocked<UpdatePointContractAddress>;
  let deleteVoucherCascadeHandler: jest.Mocked<DeleteVoucherCascade>;

  beforeEach(() => {
    mintHandler = { execute: jest.fn() } as any;
    exportAisLogHandler = { execute: jest.fn() } as any;
    exportDatabaseHandler = { execute: jest.fn() } as any;
    exportDatabaseSqlHandler = { execute: jest.fn() } as any;
    listAllPointsHandler = { execute: jest.fn() } as any;
    resetCustomerPointBalancesHandler = { execute: jest.fn() } as any;
    resetVoucherTokenIdsHandler = { execute: jest.fn() } as any;
    updatePointContractAddressHandler = { execute: jest.fn() } as any;
    deleteVoucherCascadeHandler = { execute: jest.fn() } as any;

    controller = new AdminController(
      mintHandler,
      exportAisLogHandler,
      exportDatabaseHandler,
      exportDatabaseSqlHandler,
      listAllPointsHandler,
      deleteVoucherCascadeHandler,
      resetCustomerPointBalancesHandler,
      resetVoucherTokenIdsHandler,
      updatePointContractAddressHandler,
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

  it('listAllPoints delegates to handler', async () => {
    listAllPointsHandler.execute.mockResolvedValue({
      points: [{ id: 'p1' }],
      counts: 1,
    } as any);

    const result = await controller.listAllPoints();

    expect(listAllPointsHandler.execute).toHaveBeenCalledWith();
    expect(result).toEqual({
      points: [{ id: 'p1' }],
      counts: 1,
    });
  });

  it('resetCustomerPointBalances delegates to handler', async () => {
    resetCustomerPointBalancesHandler.execute.mockResolvedValue({
      success: true,
      message: 'All customerPoint balances have been reset to 0',
      updatedCount: 5,
    });

    const result = await controller.resetCustomerPointBalances();

    expect(resetCustomerPointBalancesHandler.execute).toHaveBeenCalledWith();
    expect(result).toEqual({
      success: true,
      message: 'All customerPoint balances have been reset to 0',
      updatedCount: 5,
    });
  });

  it('updatePointContractAddress delegates to handler', async () => {
    updatePointContractAddressHandler.execute.mockResolvedValue({
      success: true,
      message: 'Point contractAddress updated successfully',
      point: {
        id: 'point-1',
        contractAddress: '0x1234',
      },
    } as any);

    const result = await controller.updatePointContractAddress(
      'point-1',
      '0x1234',
    );

    expect(updatePointContractAddressHandler.execute).toHaveBeenCalledWith(
      'point-1',
      '0x1234',
    );
    expect(result).toEqual({
      success: true,
      message: 'Point contractAddress updated successfully',
      point: {
        id: 'point-1',
        contractAddress: '0x1234',
      },
    });
  });

  it('resetVoucherTokenIds delegates to handler', async () => {
    resetVoucherTokenIdsHandler.execute.mockResolvedValue({
      success: true,
      message: 'All voucher tokenId values have been reset successfully',
      updatedCount: 3,
      startTokenId: '10000',
      endTokenId: '10002',
    });

    const result = await controller.resetVoucherTokenIds();

    expect(resetVoucherTokenIdsHandler.execute).toHaveBeenCalledWith();
    expect(result).toEqual({
      success: true,
      message: 'All voucher tokenId values have been reset successfully',
      updatedCount: 3,
      startTokenId: '10000',
      endTokenId: '10002',
    });
  });
});
