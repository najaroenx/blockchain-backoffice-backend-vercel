import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { TransferVoucherToCustomerHandler } from '../../voucher/handlers/transferVoucherToCustomer.handler';

type RewardRowOutcome =
  | { kind: 'skip' }
  | { kind: 'notFoundCustomer'; data: Record<string, unknown> }
  | { kind: 'failedTransfer'; data: Record<string, unknown> }
  | { kind: 'successTransfer'; data: Record<string, unknown> };

@Injectable()
export class ExecuteRewardsCsvHandler {
  private readonly logger = new Logger(ExecuteRewardsCsvHandler.name);
  private static readonly MAX_CSV_FILE_BYTES = 2 * 1024 * 1024; // 2 MB
  private static readonly MAX_CSV_LINES = 10000;
  private static readonly MAX_CSV_LINE_LENGTH = 10000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly transferVoucherToCustomerHandler: TransferVoucherToCustomerHandler,
  ) {}

  private parseCsvContent(fileContent: string) {
    const lines = fileContent
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .slice(0, ExecuteRewardsCsvHandler.MAX_CSV_LINES);
    const parsedRows = [];

    for (let i = 1; i < lines.length; i++) {
      const text = lines[i];
      if (text.length > ExecuteRewardsCsvHandler.MAX_CSV_LINE_LENGTH) {
        throw new BadRequestException('CSV line is too long');
      }
      const result = [];
      let current = '';
      let inQuotes = false;

      for (let j = 0; j < text.length; j++) {
        const char = text[j];
        if (char === '"' && text[j + 1] === '"') {
          current += '"';
          j++;
        } else if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current);
          current = '';
        } else {
          current += char;
        }
      }

      result.push(current.trim());
      parsedRows.push(result);
    }

    return parsedRows;
  }

  private async processRewardRow(row: string[]): Promise<RewardRowOutcome> {
    if (row.length < 12) return { kind: 'skip' };

    const sequenceNo = row[0];
    const merchantRef = row[1]?.trim();
    const status = row[8]?.trim();
    const phone = row[9]?.trim();
    const voucherId = row[11]?.trim();

    if (status !== 'ยังไม่ได้แจก' || !phone) return { kind: 'skip' };

    const customer = await this.prisma.customer.findUnique({
      where: { tel: phone },
      include: { wallet: true },
    });
    if (!customer) {
      return {
        kind: 'notFoundCustomer',
        data: { sequenceNo, phone, merchantRef },
      };
    }

    const availableCode = await this.prisma.voucherCode.findFirst({
      where: {
        voucher: {
          merchantRef: merchantRef,
        },
        currentOwnerType: 'MERCHANT',
        isUsed: false,
      },
      include: { voucher: true },
    });

    if (!availableCode?.voucher) {
      return {
        kind: 'failedTransfer',
        data: {
          sequenceNo,
          phone,
          customerWallet: customer.wallet?.walletAddress || null,
          merchantRef,
          voucherId_in_csv: voucherId,
          reason: 'NO_QUOTA_OR_MERCHANT_NOT_FOUND',
        },
      };
    }

    // Thực thiการแจกรางวัลให้ลูกค้า (Execute Transfer On-chain & Database)
    try {
      const transferResult = await this.transferVoucherToCustomerHandler.execute(
        {
          merchantId: availableCode.currentOwnerId,
          customerPhone: phone,
          voucherId: availableCode.voucherId,
          quantity: 1,
        },
      );

      return {
        kind: 'successTransfer',
        data: {
          sequenceNo,
          phone,
          customerWallet: customer.wallet?.walletAddress || null,
          merchantRef: merchantRef,
          txHash: transferResult.transactionHash,
        },
      };
    } catch (err) {
      return {
        kind: 'failedTransfer',
        data: {
          sequenceNo,
          phone,
          customerWallet: customer.wallet?.walletAddress || null,
          merchantRef: merchantRef,
          reason: err.message || 'TRANSFER_ERROR',
        },
      };
    }
  }

  async execute(file: any) {
    if (!file?.buffer) {
      throw new BadRequestException('CSV file is required');
    }

    if (file.buffer.length > ExecuteRewardsCsvHandler.MAX_CSV_FILE_BYTES) {
      throw new BadRequestException('CSV file is too large');
    }

    try {
      const fileContent = file.buffer.toString('utf-8');
      const rows = this.parseCsvContent(fileContent);

      const successTransfers = [];
      const failedTransfers = [];
      const notFoundCustomers = [];
      const notFoundMerchants = [];

      for (const row of rows) {
        const outcome = await this.processRewardRow(row);

        switch (outcome.kind) {
          case 'notFoundCustomer':
            notFoundCustomers.push(outcome.data);
            break;
          case 'failedTransfer':
            failedTransfers.push(outcome.data);
            break;
          case 'successTransfer':
            successTransfers.push(outcome.data);
            break;
          case 'skip':
          default:
            break;
        }
      }

      return {
        summary: {
          totalRecordsProcessed: rows.length,
          successCount: successTransfers.length,
          failedTransferCount: failedTransfers.length,
          notFoundCustomers: notFoundCustomers.length,
          notFoundMerchants: notFoundMerchants.length,
        },
        payload: {
          successTransfers,
          failedTransfers,
          notFoundCustomers,
          notFoundMerchants,
        },
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error(
        `Error processing CSV execute: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException('Failed to process CSV file');
    }
  }
}
