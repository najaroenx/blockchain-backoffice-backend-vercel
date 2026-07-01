import { BadRequestException } from '@nestjs/common';

export interface ParsedCsvLine {
  lineNum: number;
  columns: string[];
}

export interface BatchTransferCsvRow {
  lineNum: number;
  customerPhone: string;
  voucherId: string;
  quantity: number;
}

export interface CsvParseLimits {
  maxLines: number;
  maxLineLength: number;
}

export function parseCsv(
  content: string,
  limits: CsvParseLimits,
): ParsedCsvLine[] {
  const lines = content.split(/\r?\n/).map((line) => line.trim());
  if (lines.length > limits.maxLines) {
    throw new BadRequestException('CSV file contains too many lines');
  }

  const parsedRows: ParsedCsvLine[] = [];

  for (let i = 0; i < lines.length; i++) {
    const lineText = lines[i];
    if (!lineText) {
      continue;
    }

    if (lineText.length > limits.maxLineLength) {
      throw new BadRequestException(
        `CSV line ${i + 1} exceeds maximum length limit`,
      );
    }

    const columns: string[] = [];
    let currentBuffer = '';
    let isInsideQuotes = false;

    let j = 0;
    while (j < lineText.length) {
      const char = lineText[j];
      if (char === '"' && lineText[j + 1] === '"') {
        currentBuffer += '"';
        j += 2;
      } else if (char === '"') {
        isInsideQuotes = !isInsideQuotes;
        j++;
      } else if (char === ',' && !isInsideQuotes) {
        columns.push(currentBuffer.trim());
        currentBuffer = '';
        j++;
      } else {
        currentBuffer += char;
        j++;
      }
    }

    columns.push(currentBuffer.trim());
    parsedRows.push({ lineNum: i + 1, columns });
  }

  return parsedRows;
}

export function resolveBatchTransferColumnMapping(headers: string[]): {
  phoneIdx: number;
  voucherIdx: number;
  qtyIdx: number;
} {
  const lowerHeaders = headers.map((header) => header.toLowerCase());

  let phoneIdx = lowerHeaders.findIndex(
    (header) =>
      header.includes('phone') ||
      header.includes('tel') ||
      header.includes('โทร') ||
      header.includes('เบอร์') ||
      header.includes('contact'),
  );
  let voucherIdx = lowerHeaders.findIndex(
    (header) =>
      (header.includes('voucher') ||
        header.includes('coupon') ||
        header.includes('คูปอง')) &&
      header.includes('id'),
  );
  if (voucherIdx === -1) {
    voucherIdx = lowerHeaders.findIndex(
      (header) =>
        header === 'couponid' ||
        header === 'voucherid' ||
        header.includes('coupon') ||
        header.includes('voucher') ||
        header.includes('คูปอง'),
    );
  }
  if (voucherIdx === -1) {
    voucherIdx = lowerHeaders.findIndex((header) => header.includes('id'));
  }
  let qtyIdx = lowerHeaders.findIndex(
    (header) =>
      header.includes('qty') ||
      header.includes('quantity') ||
      header.includes('amount') ||
      header.includes('จำนวน'),
  );

  if (phoneIdx === -1) {
    phoneIdx = 0;
  }
  if (voucherIdx === -1) {
    voucherIdx = 1;
  }
  if (qtyIdx === -1) {
    qtyIdx = 2;
  }

  return { phoneIdx, voucherIdx, qtyIdx };
}

export function parseBatchTransferCsvRows(
  content: string,
  limits: CsvParseLimits,
): BatchTransferCsvRow[] {
  const parsedLines = parseCsv(content, limits);
  if (parsedLines.length < 2) {
    throw new BadRequestException(
      'CSV file is empty or lacks data rows beyond the header',
    );
  }

  const { phoneIdx, voucherIdx, qtyIdx } = resolveBatchTransferColumnMapping(
    parsedLines[0].columns,
  );

  return parsedLines
    .slice(1)
    .map((item) => {
      const customerPhone = (item.columns[phoneIdx] || '').trim();
      const voucherId = (item.columns[voucherIdx] || '').trim();
      const qtyStr = (item.columns[qtyIdx] || '1').trim();

      return {
        lineNum: item.lineNum,
        customerPhone,
        voucherId,
        quantity: Number.parseInt(qtyStr, 10),
      };
    })
    .filter((row) => row.customerPhone !== '' || row.voucherId !== '');
}
