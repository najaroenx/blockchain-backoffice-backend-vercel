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
import { getSignerFromSeedPhrase } from 'src/libs/derive-wallet';
import { randomUUID } from 'crypto';
import {
  TransactionTypeId,
  AssetType,
} from 'src/constants/transaction-types.enum';

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

  private parseCsv(
    content: string,
  ): Array<{ lineNum: number; columns: string[] }> {
    const lines = content.split(/\r?\n/).map((l) => l.trim());
    if (lines.length > ExecuteBatchTransferCsvHandler.MAX_CSV_LINES) {
      throw new BadRequestException('CSV file contains too many lines');
    }

    const parsedRows: Array<{ lineNum: number; columns: string[] }> = [];

    for (let i = 0; i < lines.length; i++) {
      const lineText = lines[i];
      if (!lineText) {
        continue; // Skip empty lines
      }

      if (lineText.length > ExecuteBatchTransferCsvHandler.MAX_LINE_LENGTH) {
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

    if (phoneIdx === -1) phoneIdx = 0;
    if (voucherIdx === -1) voucherIdx = 1;
    if (qtyIdx === -1) qtyIdx = 2;

    return { phoneIdx, voucherIdx, qtyIdx };
  }

  async execute(merchantId: string, file: UploadedCsvFile) {
    if (!merchantId) {
      throw new BadRequestException('Merchant ID is required');
    }

    if (!file || !file.buffer) {
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

    if (!merchant.wallet || !merchant.wallet.seedPhrase) {
      throw new BadRequestException(
        'Merchant wallet is not fully operational or lacks a seed phrase',
      );
    }

    // 2. Parse CSV
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

    const dataRows = parsedLines
      .slice(1)
      .map((item) => {
        const customerPhone = (item.columns[phoneIdx] || '').trim();
        const voucherId = (item.columns[voucherIdx] || '').trim();
        const qtyStr = (item.columns[qtyIdx] || '1').trim();
        const quantity = parseInt(qtyStr, 10);

        return {
          lineNum: item.lineNum,
          customerPhone,
          voucherId,
          quantity,
        };
      })
      .filter((row) => row.customerPhone !== '' || row.voucherId !== '');

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
        current + (isNaN(row.quantity) ? 0 : row.quantity),
      );
    }

    const lockedVoucherCodesByVoucherId = new Map<string, any[]>();
    for (const [voucherId, requiredQty] of cumulativeQuantities.entries()) {
      if (!voucherId) continue;

      const availableCodes = await this.prisma.$queryRawUnsafe<any[]>(
        `
        SELECT * FROM "VoucherCode"
        WHERE "voucherId" = $1
          AND "currentOwnerId" = $2
          AND "currentOwnerType" = 'MERCHANT'
          AND "isUsed" = false
        LIMIT $3
        FOR UPDATE SKIP LOCKED
      `,
        voucherId,
        merchantId,
        requiredQty,
      );

      if (!availableCodes || availableCodes.length < requiredQty) {
        throw new BadRequestException(
          `Not enough available voucher stock for voucherId ${voucherId}. Requested ${requiredQty}, found ${availableCodes?.length || 0}`,
        );
      }

      lockedVoucherCodesByVoucherId.set(voucherId, availableCodes);
    }

    // 6. Decrypt Merchant Seed Phrase once
    const salt = this.configService.get<string>('SALT');
    if (!salt) {
      throw new Error('SALT not found in config service');
    }
    const decryptedSeedPhrase = this.tokenService.decryptKey(
      salt,
      merchant.wallet.seedPhrase,
    );
    if (!decryptedSeedPhrase) {
      throw new Error('Failed to decrypt merchant seed phrase');
    }

    const merchantSigner = getSignerFromSeedPhrase(
      decryptedSeedPhrase,
      merchant.wallet.derivationIndex,
    );
    const merchantPrivateKey = merchantSigner.privateKey;

    // Track allocated codes slices
    const codeAllocators = new Map<string, number>();
    for (const vId of cumulativeQuantities.keys()) {
      codeAllocators.set(vId, 0);
    }

    const results: any[] = [];
    let successCount = 0;
    let failedCount = 0;

    // 7. Sequential trace loop
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const { customerPhone, voucherId, quantity } = row;

      // Basic validations
      if (!customerPhone || !voucherId || isNaN(quantity) || quantity <= 0) {
        let errMsg = 'Invalid Row Data';
        if (!customerPhone) errMsg = 'Customer phone number is missing';
        else if (!voucherId) errMsg = 'Voucher ID is missing';
        else if (quantity <= 0 || isNaN(quantity))
          errMsg = 'Quantity must be a positive integer';

        results.push({
          seqNo: i + 1,
          phone: customerPhone,
          couponId: voucherId,
          quantity: isNaN(quantity) ? 0 : quantity,
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

      if (!customer.wallet || !customer.wallet.walletAddress) {
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

      // Slice codes for this specific transfer
      const fullList = lockedVoucherCodesByVoucherId.get(voucherId)!;
      const startIndex = codeAllocators.get(voucherId)!;
      const allocatedCodes = fullList.slice(startIndex, startIndex + quantity);
      codeAllocators.set(voucherId, startIndex + quantity);

      const voucherCodeIds = allocatedCodes.map((c) => c.id);
      const typeId = parseInt(voucher.tokenId, 10);

      try {
        this.logger.log(
          `[BatchJob ${batchJobId}] [Item ${i + 1}/${dataRows.length}] CSV Direct execution transfer: ${quantity} x tokenId ${typeId} for phone ${customerPhone}`,
        );

        // Invoke single on-chain transfer
        const txHash = await this.blockchainService.transferCoupon(
          typeId,
          quantity,
          merchant.wallet.walletAddress,
          customer.wallet.walletAddress,
          merchantPrivateKey,
        );

        const txHashBuffer = Buffer.from(txHash.replace(/^0x/, ''), 'hex');
        const senderAddressBuffer = Buffer.from(
          merchant.wallet.walletAddress.replace(/^0x/, ''),
          'hex',
        );
        const receiverAddressBuffer = Buffer.from(
          customer.wallet.walletAddress.replace(/^0x/, ''),
          'hex',
        );

        // Update ownership and save transaction records
        try {
          await this.prisma.$transaction(async (tx) => {
            await tx.voucherCode.updateMany({
              where: { id: { in: voucherCodeIds } },
              data: {
                currentOwnerId: customer.id,
                currentOwnerType: 'CUSTOMER',
                voucherGroupId: null,
              },
            });

            await Promise.all(
              voucherCodeIds.map((codeId) =>
                tx.transaction.create({
                  data: {
                    txHash: txHashBuffer,
                    amount: 1,
                    senderAddress: senderAddressBuffer,
                    receiverAddress: receiverAddressBuffer,
                    merchantId: merchant.id,
                    merchantRef: voucher.merchantRef || null,
                    voucherCodeId: codeId,
                    senderId: merchant.id,
                    receiverId: customer.id,
                    senderType: 'MERCHANT',
                    receiverType: 'CUSTOMER',
                    transactionTypeId: TransactionTypeId.TRANSFER,
                    type: AssetType.VOUCHER,
                    transactionRefId: batchJobId,
                  },
                }),
              ),
            );
          });

          results.push({
            seqNo: i + 1,
            phone: customerPhone,
            couponId: voucherId,
            quantity,
            status: 'SUCCESS',
            transactionHash: txHash,
            voucherCodeId: voucherCodeIds[0],
          });
          successCount++;
        } catch (dbError) {
          // DATABASE FAIL but BLOCKCHAIN SUCCESS! Major desynchronization risk!
          const desyncErrorMessage = `CRITICAL DESYNC ERROR [BatchJob ${batchJobId}] Blockchain transfer succeeded (TxHash: ${txHash}) but Prisma database update failed. Error: ${dbError.message}`;
          this.logger.error(
            `!!! CRITICAL DESYNC ALERT !!!\n${desyncErrorMessage}\nStack: ${dbError.stack}\nPlease recover manually!`,
          );

          results.push({
            seqNo: i + 1,
            phone: customerPhone,
            couponId: voucherId,
            quantity,
            status: 'FAILED',
            error: `Prisma Database Error: ${dbError.message}`,
            transactionHash: txHash, // crucial to keep txHash!
            isDesynced: true,
            desyncMessage:
              'Blockchain transfer succeeded but local database update failed. Manual reconciliation is required.',
          });
          failedCount++;
        }
      } catch (blockchainError) {
        this.logger.error(
          `[BatchJob ${batchJobId}] Failed to execute on-chain transfer for item ${i + 1} from CSV: ${blockchainError.message}`,
        );
        results.push({
          seqNo: i + 1,
          phone: customerPhone,
          couponId: voucherId,
          quantity,
          status: 'FAILED',
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
