import {
  Injectable,
  BadRequestException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';
import { TokenService } from 'src/providers/token/token.service';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { parseBatchTransferCsvRows } from '../utils/batch-transfer-csv.util';
import {
  DirectVoucherTransferFailure,
  executeDirectVoucherTransfer,
  getMerchantPrivateKey,
  insufficientWalletPoolError,
  lockAvailableMerchantVoucherCodes,
} from '../utils/direct-voucher-transfer.util';

export interface UploadedCsvFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

@Injectable()
export class ExecuteBatchTransferCsvHandler {
  private readonly logger = new Logger(ExecuteBatchTransferCsvHandler.name);
  private static readonly MAX_CSV_BYTES = 5 * 1024 * 1024; // 5MB
  private static readonly MAX_CSV_LINES = 10000;
  private static readonly MAX_LINE_LENGTH = 5000;
  private static readonly SAFE_TRANSFER_LIMIT = 50; // To prevent gateway timeouts

  constructor(
    private readonly prisma: PrismaService,
    private readonly blockchainService: BlockchainService,
    private readonly tokenService: TokenService,
    private readonly configService: ConfigService,
  ) {}

  async execute(merchantId: string, file: UploadedCsvFile) {
    if (!merchantId) {
      throw new BadRequestException('Merchant ID is required');
    }

    if (!file?.buffer) {
      throw new BadRequestException('CSV file is required');
    }

    if (file.buffer.length > ExecuteBatchTransferCsvHandler.MAX_CSV_BYTES) {
      throw new BadRequestException('CSV file size exceeds 5MB limit');
    }

    const batchJobId = randomUUID();
    const fileName = file.originalname || 'uploaded_file.csv';

    // 1. Get Merchant Info & Validate Wallet
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
      include: { wallet: true },
    });

    if (!merchant) {
      throw new NotFoundException(`Merchant with ID ${merchantId} not found`);
    }

    if (!merchant.wallet?.seedPhrase) {
      throw new BadRequestException(
        'Merchant wallet is not fully operational or lacks a seed phrase',
      );
    }

    // 2. Parse CSV
    const fileContent = file.buffer.toString('utf-8');
    const dataRows = parseBatchTransferCsvRows(fileContent, {
      maxLines: ExecuteBatchTransferCsvHandler.MAX_CSV_LINES,
      maxLineLength: ExecuteBatchTransferCsvHandler.MAX_LINE_LENGTH,
    });

    if (dataRows.length > ExecuteBatchTransferCsvHandler.SAFE_TRANSFER_LIMIT) {
      throw new BadRequestException(
        `Batch transfer via CSV has a strict limit of ${ExecuteBatchTransferCsvHandler.SAFE_TRANSFER_LIMIT} transfers per file to prevent timeout. Please split your file.`,
      );
    }

    // 3. Resolve Customers in Bulk
    const uniquePhones = [
      ...new Set(dataRows.map((r) => r.customerPhone).filter(Boolean)),
    ];
    const customers = await this.prisma.customer.findMany({
      where: { tel: { in: uniquePhones } },
      include: { wallet: true },
    });

    const customerMap = new Map<string, (typeof customers)[0]>();
    for (const c of customers) {
      customerMap.set(c.tel, c);
    }

    // 4. Resolve Vouchers in Bulk
    const uniqueVoucherIds = [
      ...new Set(dataRows.map((r) => r.voucherId).filter(Boolean)),
    ];
    const vouchers = await this.prisma.voucher.findMany({
      where: { id: { in: uniqueVoucherIds } },
    });

    const voucherMap = new Map<string, (typeof vouchers)[0]>();
    for (const v of vouchers) {
      voucherMap.set(v.id, v);
    }

    // 5. Check Stock and lock required VoucherCodes using SKIP LOCKED
    const cumulativeQuantities = new Map<string, number>();
    for (const row of dataRows) {
      const current = cumulativeQuantities.get(row.voucherId) || 0;
      cumulativeQuantities.set(
        row.voucherId,
        current + (Number.isNaN(row.quantity) ? 0 : row.quantity),
      );
    }

    for (const [voucherId, requiredQty] of cumulativeQuantities.entries()) {
      if (!voucherId) continue;

      const availableCodes = await lockAvailableMerchantVoucherCodes(
        this.prisma,
        {
          voucherId,
          merchantId,
          quantity: requiredQty,
        },
      );

      if (!availableCodes || availableCodes.length < requiredQty) {
        throw insufficientWalletPoolError({
          voucherId,
          requested: requiredQty,
          available: availableCodes?.length || 0,
        });
      }
    }

    // 6. Decrypt Merchant Seed Phrase once
    const merchantPrivateKey = getMerchantPrivateKey(
      this.configService,
      this.tokenService,
      merchant,
    );

    const results: any[] = [];
    let successCount = 0;
    let failedCount = 0;

    // 7. Sequential trace loop
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const { customerPhone, voucherId, quantity } = row;

      // Basic validations
      if (
        !customerPhone ||
        !voucherId ||
        Number.isNaN(quantity) ||
        quantity <= 0
      ) {
        let errMsg = 'Invalid Row Data';
        if (!customerPhone) errMsg = 'Customer phone number is missing';
        else if (!voucherId) errMsg = 'Voucher ID is missing';
        else if (quantity <= 0 || Number.isNaN(quantity))
          errMsg = 'Quantity must be a positive integer';

        results.push({
          seqNo: i + 1,
          phone: customerPhone,
          couponId: voucherId,
          quantity: Number.isNaN(quantity) ? 0 : quantity,
          status: 'FAILED',
          error: errMsg,
        });
        failedCount++;
        continue;
      }

      const customer = customerMap.get(customerPhone);
      const voucher = voucherMap.get(voucherId);

      if (!customer) {
        results.push({
          seqNo: i + 1,
          phone: customerPhone,
          couponId: voucherId,
          quantity,
          status: 'FAILED',
          error: `Customer phone number '${customerPhone}' is unregistered`,
        });
        failedCount++;
        continue;
      }

      if (!customer.wallet?.walletAddress) {
        results.push({
          seqNo: i + 1,
          phone: customerPhone,
          couponId: voucherId,
          quantity,
          status: 'FAILED',
          error: 'Customer has no active blockchain wallet address',
        });
        failedCount++;
        continue;
      }

      if (!voucher) {
        results.push({
          seqNo: i + 1,
          phone: customerPhone,
          couponId: voucherId,
          quantity,
          status: 'FAILED',
          error: `Voucher ID '${voucherId}' does not exist`,
        });
        failedCount++;
        continue;
      }

      if (!voucher.tokenId) {
        results.push({
          seqNo: i + 1,
          phone: customerPhone,
          couponId: voucherId,
          quantity,
          status: 'FAILED',
          error: `Voucher type '${voucherId}' lacks a configured blockchain tokenId`,
        });
        failedCount++;
        continue;
      }

      const typeId = Number.parseInt(voucher.tokenId, 10);

      try {
        this.logger.log(
          `[BatchJob ${batchJobId}] [Item ${i + 1}/${dataRows.length}] CSV Direct execution transfer: ${quantity} x tokenId ${typeId} for phone ${customerPhone}`,
        );

        const executedTransfer = await executeDirectVoucherTransfer({
          prisma: this.prisma,
          blockchainService: this.blockchainService,
          merchant,
          customer,
          voucher,
          voucherId,
          typeId,
          quantity,
          merchantPrivateKey,
        });
        const voucherCodeIds = executedTransfer.voucherCodes.map(
          (code) => code.id,
        );

        results.push({
          seqNo: i + 1,
          phone: customerPhone,
          couponId: voucherId,
          quantity,
          status: 'SUCCESS',
          operationId: executedTransfer.operationId,
          transactionHash: executedTransfer.txHash,
          voucherCodeId: voucherCodeIds[0],
        });
        successCount++;
      } catch (blockchainError) {
        const transferFailure = blockchainError as DirectVoucherTransferFailure;
        this.logger.error(
          `[BatchJob ${batchJobId}] Failed to execute on-chain transfer for item ${i + 1} from CSV: ${blockchainError.message}`,
        );

        if (transferFailure.chainConfirmed && transferFailure.transactionHash) {
          results.push({
            seqNo: i + 1,
            phone: customerPhone,
            couponId: voucherId,
            quantity,
            status: 'FAILED',
            operationId: transferFailure.directTransferOperationId,
            error: `Prisma Database Error: ${blockchainError.message}`,
            transactionHash: transferFailure.transactionHash,
            isDesynced: true,
            desyncMessage:
              'Blockchain transfer succeeded but local database update failed. Manual reconciliation is required.',
          });
          failedCount++;
          continue;
        }

        results.push({
          seqNo: i + 1,
          phone: customerPhone,
          couponId: voucherId,
          quantity,
          status: 'FAILED',
          operationId: transferFailure.directTransferOperationId,
          transactionHash: transferFailure.transactionHash,
          error: blockchainError.message,
        });
        failedCount++;
      }
    }

    // Determine final job status
    let finalStatus = 'SUCCESS';
    if (successCount > 0 && failedCount > 0) {
      finalStatus = 'PARTIAL_FAILED';
    } else if (successCount === 0 && failedCount > 0) {
      finalStatus = 'FAILED';
    }

    // Put details log to BatchTransferLog table
    await this.prisma.batchTransferLog.create({
      data: {
        id: batchJobId,
        merchantId,
        fileName,
        totalRecords: dataRows.length,
        successfulCount: successCount,
        failedCount,
        status: finalStatus,
        details: results as any,
        technicalLogs:
          finalStatus !== 'SUCCESS'
            ? JSON.stringify(results.filter((r) => r.status === 'FAILED'))
            : null,
      },
    });

    return {
      message: 'Batch transfer process finished',
      totalProcessed: dataRows.length,
      successful: successCount,
      failed: failedCount,
      batchJobId,
      results,
    };
  }
}
