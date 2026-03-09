import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AisTransferLog } from '@prisma/client';
import { endOfDay, format, startOfDay } from 'date-fns';
import * as ExcelJS from 'exceljs';
import { PrismaService } from 'prisma/prisma.service';
import { ExportAisLogQueryDto } from '../dtos/export-ais-log-query.dto';

@Injectable()
export class ExportAisLog {
  private readonly logger = new Logger(ExportAisLog.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(query: ExportAisLogQueryDto): Promise<{
    fileBuffer: Buffer;
    fileName: string;
  }> {
    const { startDate, endDate } = this.parseDateRange(query);

    this.logger.log(
      `Exporting AIS transfer log from ${startDate.toISOString()} to ${endDate.toISOString()}`,
    );

    const logs = await this.getLogs(startDate, endDate);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('AIS Transfer Log');

    worksheet.columns = [
      { header: 'ID', key: 'id', width: 24 },
      { header: 'Transaction ID', key: 'transactionID', width: 24 },
      { header: 'Action', key: 'action', width: 20 },
      { header: 'URL', key: 'url', width: 40 },
      { header: 'Request Body', key: 'requestBody', width: 60 },
      { header: 'Response Body', key: 'responseBody', width: 60 },
      { header: 'HTTP Status', key: 'httpStatus', width: 14 },
      { header: 'Success', key: 'success', width: 12 },
      { header: 'Error Message', key: 'errorMessage', width: 32 },
      { header: 'MSISDN', key: 'msisdn', width: 20 },
      { header: 'Points', key: 'points', width: 12 },
      { header: 'Created At', key: 'createdAt', width: 24 },
    ];

    worksheet.getRow(1).font = { bold: true };
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];

    for (const log of logs) {
      worksheet.addRow(this.mapLogRow(log));
    }

    worksheet.columns.forEach((column) => {
      let maxLength = column.width ?? 10;

      column.eachCell({ includeEmpty: true }, (cell) => {
        const cellLength = String(cell.value ?? '').length;
        maxLength = Math.min(Math.max(maxLength, cellLength + 2), 100);
      });

      column.width = maxLength;
    });

    const workbookBuffer = await workbook.xlsx.writeBuffer();
    const fileName = this.buildFileName(query, endDate);

    return {
      fileBuffer: Buffer.from(workbookBuffer),
      fileName,
    };
  }

  private async getLogs(startDate: Date, endDate: Date) {
    try {
      return await this.prisma.aisTransferLog.findMany({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      });
    } catch (error) {
      if (this.isMissingAisTransferLogTableError(error)) {
        this.logger.error(
          'AisTransferLog table is missing in the current database. Apply migration 20260225000000_add_ais_transfer_log before using this endpoint.',
        );
        throw new ServiceUnavailableException(
          'AIS transfer log table is not available in the current database. Apply migration 20260225000000_add_ais_transfer_log.',
        );
      }

      throw error;
    }
  }

  private parseDateRange(query: ExportAisLogQueryDto): {
    startDate: Date;
    endDate: Date;
  } {
    const startDate = startOfDay(new Date(query.startDate));
    const endDate = query.endDate
      ? endOfDay(new Date(query.endDate))
      : new Date();

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new BadRequestException('Invalid date range');
    }

    if (startDate > endDate) {
      throw new BadRequestException(
        'startDate must be before or equal to endDate',
      );
    }

    return { startDate, endDate };
  }

  private mapLogRow(
    log: AisTransferLog,
  ): Record<string, string | number | boolean | null> {
    return {
      id: log.id,
      transactionID: log.transactionID,
      action: log.action,
      url: log.url,
      requestBody: this.decodeBytes(log.requestBody),
      responseBody: this.decodeBytes(log.responseBody),
      httpStatus: log.httpStatus,
      success: log.success,
      errorMessage: log.errorMessage,
      msisdn: log.msisdn,
      points: log.points,
      createdAt: format(log.createdAt, 'yyyy-MM-dd HH:mm:ss'),
    };
  }

  private decodeBytes(value: Uint8Array<ArrayBufferLike> | null): string {
    if (!value) {
      return '';
    }

    const text = Buffer.from(value).toString('utf-8');

    try {
      return JSON.stringify(JSON.parse(text));
    } catch {
      return text;
    }
  }

  private buildFileName(
    query: ExportAisLogQueryDto,
    resolvedEndDate: Date,
  ): string {
    const endDateLabel =
      query.endDate ?? format(resolvedEndDate, 'yyyy-MM-dd-HHmmss');

    return `ais-transfer-log-${query.startDate}-to-${endDateLabel}.xlsx`;
  }

  private isMissingAisTransferLogTableError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const maybeError = error as { code?: string; message?: string };

    return (
      maybeError.code === 'P2021' ||
      (maybeError.message?.includes('AisTransferLog') === true &&
        maybeError.message.includes('does not exist'))
    );
  }
}
