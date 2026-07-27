import {
  Injectable,
  Logger,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';
import { randomUUID } from 'node:crypto';
import { TokenService } from 'src/providers/token/token.service';
import { ConfigService } from '@nestjs/config';
import { BatchTransferVoucherDto } from '../dtos/batch-transfer-voucher.dto';
import {
  executeDirectVoucherTransfer,
  getMerchantPrivateKey,
  insufficientWalletPoolError,
  lockAvailableMerchantVoucherCodes,
} from '../utils/direct-voucher-transfer.util';

export interface BatchTransferTaskResult {
  customerPhone: string;
  voucherId: string;
  quantity: number;
  status: 'SUCCESS' | 'FAILED';
  operationId?: string;
  transactionHash?: string;
  voucherCodeIds?: string[];
  transactionIds?: string[];
  error?: string;
}

@Injectable()
export class BatchTransferVoucherToCustomerHandler {
  private readonly logger = new Logger(
    BatchTransferVoucherToCustomerHandler.name,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly blockchainService: BlockchainService,
    private readonly tokenService: TokenService,
    private readonly configService: ConfigService,
  ) {}

  async execute(dto: BatchTransferVoucherDto) {
    const { merchantId, transfers } = dto;
    const batchJobId = randomUUID();

    if (!Array.isArray(transfers)) {
      throw new BadRequestException('transfers must be an array');
    }

    const MAX_BATCH_TRANSFERS = 1000;
    if (transfers.length > MAX_BATCH_TRANSFERS) {
      throw new BadRequestException(
        `transfers exceeds maximum allowed size of ${MAX_BATCH_TRANSFERS}`,
      );
    }

    this.logger.log(
      `[BatchJob ${batchJobId}] Starting batch transfer process for merchant ${merchantId} with ${transfers.length} transfers`,
    );

    try {
      // 1. Get Merchant Info & Validate Wallet
      const merchant = await this.prisma.merchant.findUnique({
        where: { id: merchantId },
        include: { wallet: true },
      });

      if (!merchant?.wallet?.seedPhrase) {
        throw new NotFoundException(
          'Merchant or Merchant Wallet seed phrase not found',
        );
      }

      // 2. Validate and retrieve Customers (In Bulk to optimize)
      const uniquePhones = [...new Set(transfers.map((t) => t.customerPhone))];
      const customersList = await this.prisma.customer.findMany({
        where: { tel: { in: uniquePhones } },
        include: { wallet: true },
      });

      const customerMap = new Map<string, (typeof customersList)[0]>();
      for (const customer of customersList) {
        customerMap.set(customer.tel, customer);
      }

      // Check early if any customer phone is not found or has no wallet
      for (const transfer of transfers) {
        const tgtCustomer = customerMap.get(transfer.customerPhone);
        if (!tgtCustomer) {
          throw new NotFoundException(
            `Customer with phone number ${transfer.customerPhone} not found`,
          );
        }
        if (!tgtCustomer.wallet) {
          throw new NotFoundException(
            `Wallet not found for customer phone ${transfer.customerPhone}`,
          );
        }
      }

      // 3. Validate and retrieve Vouchers (In Bulk to optimize)
      const uniqueVoucherIds = [...new Set(transfers.map((t) => t.voucherId))];
      const vouchersList = await this.prisma.voucher.findMany({
        where: { id: { in: uniqueVoucherIds } },
      });

      const voucherMap = new Map<string, (typeof vouchersList)[0]>();
      for (const v of vouchersList) {
        voucherMap.set(v.id, v);
      }

      // Check early if any voucher is not found or lacks tokenId
      for (const transfer of transfers) {
        const tgtVoucher = voucherMap.get(transfer.voucherId);
        if (!tgtVoucher) {
          throw new NotFoundException(
            `Voucher ${transfer.voucherId} not found`,
          );
        }
        if (!tgtVoucher.tokenId) {
          throw new NotFoundException(
            `Token ID not configured for Voucher ${transfer.voucherId}`,
          );
        }
      }

      // 4. Cumulative Inventory/Stock Aggregation & Lock
      const cumulativeQuantities = new Map<string, number>();
      for (const transfer of transfers) {
        const currentTotal = cumulativeQuantities.get(transfer.voucherId) || 0;
        cumulativeQuantities.set(
          transfer.voucherId,
          currentTotal + transfer.quantity,
        );
      }

      // Preflight cumulative stock. Each item is reserved again atomically
      // immediately before its blockchain submission.
      for (const [voucherId, requiredQty] of cumulativeQuantities.entries()) {
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

      // 5. Decrypt Merchant Seed Phrase once
      const merchantPrivateKey = getMerchantPrivateKey(
        this.configService,
        this.tokenService,
        merchant,
      );

      const results: BatchTransferTaskResult[] = [];
      let successCount = 0;
      let failedCount = 0;

      // 6. Sequential Trace & On-chain execution loop
      for (let i = 0; i < transfers.length; i++) {
        const transfer = transfers[i];
        const { customerPhone, voucherId, quantity } = transfer;
        const customer = customerMap.get(customerPhone)!;
        const voucher = voucherMap.get(voucherId)!;
        const typeId = Number.parseInt(voucher.tokenId!, 10);

        try {
          this.logger.log(
            `[BatchJob ${batchJobId}] [Item ${i + 1}/${transfers.length}] Distributing ${quantity} x Voucher tokenId ${typeId} to customer ${customer.wallet!.walletAddress}`,
          );

          const executedTransfer = await executeDirectVoucherTransfer({
            prisma: this.prisma,
            blockchainService: this.blockchainService,
            merchant,
            customer: { ...customer, wallet: customer.wallet! },
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
            customerPhone,
            voucherId,
            quantity,
            status: 'SUCCESS',
            operationId: executedTransfer.operationId,
            transactionHash: executedTransfer.txHash,
            voucherCodeIds,
            transactionIds: executedTransfer.transactions.map((tx) => tx.id),
          });
          successCount++;
        } catch (itemError) {
          this.logger.error(
            `[BatchJob ${batchJobId}] Failed to process item ${i + 1} (${quantity} x ${voucherId} to ${customerPhone}): ${itemError.message}`,
            itemError.stack,
          );

          results.push({
            customerPhone,
            voucherId,
            quantity,
            status: 'FAILED',
            error: itemError.message,
          });
          failedCount++;
        }
      }

      this.logger.log(
        `[BatchJob ${batchJobId}] Batch transfer process finished. Total processed: ${transfers.length}. Successful: ${successCount}. Failed: ${failedCount}`,
      );

      return {
        batchJobId,
        message: 'Batch transfer process finished',
        totalProcessed: transfers.length,
        successful: successCount,
        failed: failedCount,
        results,
      };
    } catch (error) {
      this.logger.error(
        `[BatchJob ${batchJobId}] Error in batchTransferVoucher: ${error.message}`,
        error.stack,
      );
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Failed to execute batch transfer: ${error.message}`,
      );
    }
  }
}
