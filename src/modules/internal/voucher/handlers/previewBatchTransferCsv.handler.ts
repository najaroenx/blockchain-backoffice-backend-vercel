import {
  Injectable,
  BadRequestException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';

export interface UploadedCsvFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

export interface CsvPreviewRowResult {
  line: number;
  customerPhone: string;
  voucherId: string;
  quantity: number;
  isValid: boolean;
  errors: string[];
}

export interface CsvPreviewResponseDto {
  isValidAll: boolean;
  summary: {
    totalRowsProcessed: number;
    validRowsCount: number;
    invalidRowsCount: number;
    totalQuantity: number;
  };
  details: CsvPreviewRowResult[];
}

@Injectable()
export class PreviewBatchTransferCsvHandler {
  private readonly logger = new Logger(PreviewBatchTransferCsvHandler.name);
  private static readonly MAX_CSV_BYTES = 5 * 1024 * 1024; // 5MB
  private static readonly MAX_CSV_LINES = 10000;
  private static readonly MAX_LINE_LENGTH = 5000;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Parses CSV string contents and extracts rows.
   * Leverages a highly robust RFC-compliant quote-aware scanner.
   */
  private parseCsv(
    content: string,
  ): Array<{ lineNum: number; columns: string[] }> {
    const lines = content.split(/\r?\n/).map((l) => l.trim());
    if (lines.length > PreviewBatchTransferCsvHandler.MAX_CSV_LINES) {
      throw new BadRequestException('CSV file contains too many lines');
    }

    const parsedRows: Array<{ lineNum: number; columns: string[] }> = [];

    for (let i = 0; i < lines.length; i++) {
      const lineText = lines[i];
      if (!lineText) {
        continue; // Skip empty lines
      }

      if (lineText.length > PreviewBatchTransferCsvHandler.MAX_LINE_LENGTH) {
        throw new BadRequestException(
          `CSV line ${i + 1} exceeds maximum length limit`,
        );
      }

      const columns: string[] = [];
      let currentBuffer = '';
      let isInsideQuotes = false;

      for (let j = 0; j < lineText.length; j++) {
        const char = lineText[j];
        if (char === '"' && lineText[j + 1] === '"') {
          currentBuffer += '"';
          j++; // Skip double quote
        } else if (char === '"') {
          isInsideQuotes = !isInsideQuotes;
        } else if (char === ',' && !isInsideQuotes) {
          columns.push(currentBuffer.trim());
          currentBuffer = '';
        } else {
          currentBuffer += char;
        }
      }
      columns.push(currentBuffer.trim());
      parsedRows.push({ lineNum: i + 1, columns });
    }

    return parsedRows;
  }

  /**
   * Helper to identify columns dynamic mapping from header row
   */
  private resolveColumnMapping(headers: string[]): {
    phoneIdx: number;
    voucherIdx: number;
    qtyIdx: number;
  } {
    const lowerHeaders = headers.map((h) => h.toLowerCase());

    let phoneIdx = lowerHeaders.findIndex(
      (h) =>
        h.includes('phone') ||
        h.includes('tel') ||
        h.includes('โทร') ||
        h.includes('เบอร์') ||
        h.includes('contact'),
    );
    let voucherIdx = lowerHeaders.findIndex(
      (h) =>
        (h.includes('voucher') ||
          h.includes('coupon') ||
          h.includes('คูปอง')) &&
        h.includes('id'),
    );
    if (voucherIdx === -1) {
      voucherIdx = lowerHeaders.findIndex(
        (h) =>
          h === 'couponid' ||
          h === 'voucherid' ||
          h.includes('coupon') ||
          h.includes('voucher') ||
          h.includes('คูปอง'),
      );
    }
    if (voucherIdx === -1) {
      voucherIdx = lowerHeaders.findIndex((h) => h.includes('id'));
    }
    let qtyIdx = lowerHeaders.findIndex(
      (h) =>
        h.includes('qty') ||
        h.includes('quantity') ||
        h.includes('amount') ||
        h.includes('จำนวน'),
    );

    // Dynamic defaults if auto-matching fails
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

  async execute(
    merchantId: string,
    file: UploadedCsvFile,
  ): Promise<CsvPreviewResponseDto> {
    if (!merchantId) {
      throw new BadRequestException('Merchant ID is required');
    }

    if (!file || !file.buffer) {
      throw new BadRequestException('CSV file is required');
    }

    if (file.buffer.length > PreviewBatchTransferCsvHandler.MAX_CSV_BYTES) {
      throw new BadRequestException('CSV file size exceeds 5MB limit');
    }

    // Ensure merchant exists and has valid configuration
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
      include: { wallet: true },
    });

    if (!merchant) {
      throw new NotFoundException(`Merchant with ID ${merchantId} not found`);
    }

    if (!merchant.wallet || !merchant.wallet.seedPhrase) {
      throw new BadRequestException(
        'Merchant wallet is not fully operational or lacks a configuration seed phrase',
      );
    }

    const fileContent = file.buffer.toString('utf-8');
    const parsedLines = this.parseCsv(fileContent);

    if (parsedLines.length < 2) {
      throw new BadRequestException(
        'CSV file is empty or lacks data rows beyond the header',
      );
    }

    const headerRow = parsedLines[0].columns;
    const { phoneIdx, voucherIdx, qtyIdx } =
      this.resolveColumnMapping(headerRow);

    // Map rows starting from index 1 (headers skipped)
    const dataRows = parsedLines.slice(1).map((item) => {
      const customerPhone = item.columns[phoneIdx] || '';
      const voucherId = item.columns[voucherIdx] || '';
      const qtyStr = item.columns[qtyIdx] || '1';
      const quantity = parseInt(qtyStr, 10);

      return {
        lineNum: item.lineNum,
        customerPhone,
        voucherId,
        quantity,
      };
    });

    // 1. Gather all phone numbers and fetch from DB in bulk
    const uniquePhones = [
      ...new Set(dataRows.map((r) => r.customerPhone).filter(Boolean)),
    ];
    const customers = await this.prisma.customer.findMany({
      where: { tel: { in: uniquePhones } },
      include: { wallet: true },
    });

    const customerMap = new Map<string, (typeof customers)[0]>();
    for (const customer of customers) {
      customerMap.set(customer.tel, customer);
    }

    // 2. Gather all voucher IDs and fetch from DB in bulk
    const uniqueVoucherIds = [
      ...new Set(dataRows.map((r) => r.voucherId).filter(Boolean)),
    ];
    const vouchers = await this.prisma.voucher.findMany({
      where: { id: { in: uniqueVoucherIds } },
    });

    const voucherMap = new Map<string, (typeof vouchers)[0]>();
    for (const voucher of vouchers) {
      voucherMap.set(voucher.id, voucher);
    }

    // 3. Look up stock balances (unused codes owned by this merchant) in bulk
    const stockStats = await this.prisma.voucherCode.groupBy({
      by: ['voucherId'],
      where: {
        voucherId: { in: uniqueVoucherIds },
        currentOwnerId: merchantId,
        currentOwnerType: 'MERCHANT',
        isUsed: false,
      },
      _count: {
        id: true,
      },
    });

    const stockMap = new Map<string, number>();
    for (const stat of stockStats) {
      stockMap.set(stat.voucherId, stat._count.id);
    }

    // Track cumulative quantities requested per voucher type to prevent overallocation
    const cumulativeRequestedMap = new Map<string, number>();
    const details: CsvPreviewRowResult[] = [];
    let isValidAll = true;
    let totalQuantity = 0;
    let validRowsCount = 0;
    let invalidRowsCount = 0;

    for (const row of dataRows) {
      const errors: string[] = [];

      // A. Validations for customers
      if (!row.customerPhone) {
        errors.push('Customer phone number is missing');
      } else {
        const customer = customerMap.get(row.customerPhone);
        if (!customer) {
          errors.push(
            `Customer phone number '${row.customerPhone}' is unregistered`,
          );
        } else if (!customer.wallet || !customer.wallet.walletAddress) {
          errors.push(`Customer has no active blockchain wallet address`);
        }
      }

      // B. Validations for voucher config
      if (!row.voucherId) {
        errors.push('Voucher ID is missing');
      } else {
        const voucher = voucherMap.get(row.voucherId);
        if (!voucher) {
          errors.push(`Voucher ID '${row.voucherId}' does not exist`);
        } else if (!voucher.tokenId) {
          errors.push(
            `Voucher type '${row.voucherId}' lacks a configured blockchain tokenId`,
          );
        }
      }

      // C. Validations for quantities & stock level
      if (isNaN(row.quantity) || row.quantity <= 0) {
        errors.push('Quantity must be a positive integer greater than zero');
      } else if (isValidNumber(row.quantity)) {
        totalQuantity += row.quantity;

        if (row.voucherId) {
          const prevTotal = cumulativeRequestedMap.get(row.voucherId) || 0;
          const currentTotal = prevTotal + row.quantity;
          cumulativeRequestedMap.set(row.voucherId, currentTotal);

          const availableStock = stockMap.get(row.voucherId) || 0;
          if (currentTotal > availableStock) {
            errors.push(
              `Insufficient voucher code stock! Line requested ${row.quantity} (cumulative: ${currentTotal}), but merchant only holds ${availableStock} codes`,
            );
          }
        }
      }

      const rowIsValid = errors.length === 0;
      if (rowIsValid) {
        validRowsCount++;
      } else {
        invalidRowsCount++;
        isValidAll = false;
      }

      details.push({
        line: row.lineNum,
        customerPhone: row.customerPhone,
        voucherId: row.voucherId,
        quantity: isNaN(row.quantity) ? 0 : row.quantity,
        isValid: rowIsValid,
        errors,
      });
    }

    return {
      isValidAll,
      summary: {
        totalRowsProcessed: dataRows.length,
        validRowsCount,
        invalidRowsCount,
        totalQuantity,
      },
      details,
    };
  }
}

function isValidNumber(num: number): boolean {
  return typeof num === 'number' && !isNaN(num);
}
