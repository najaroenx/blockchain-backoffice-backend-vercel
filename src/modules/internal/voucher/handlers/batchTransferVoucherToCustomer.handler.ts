import {
  Injectable,
  Logger,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';
import { randomUUID } from 'crypto';
import { TokenService } from 'src/providers/token/token.service';
import { ConfigService } from '@nestjs/config';
import { getSignerFromSeedPhrase } from 'src/libs/derive-wallet';
import { BatchTransferVoucherDto } from '../dtos/batch-transfer-voucher.dto';
import { writeDirectVoucherTransferLedger } from '../utils/direct-voucher-transfer.util';

export interface BatchTransferTaskResult {
  customerPhone: string;
  voucherId: string;
  quantity: number;
  status: 'SUCCESS' | 'FAILED';
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

      if (!merchant || !merchant.wallet || !merchant.wallet.seedPhrase) {
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

      // Lock and fetch available VoucherCodes for each needed voucherId using SKIP LOCKED
      const lockedVoucherCodesByVoucherId = new Map<string, any[]>();
      for (const [voucherId, requiredQty] of cumulativeQuantities.entries()) {
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

      // 5. Decrypt Merchant Seed Phrase once
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

      // Prepare code allocators
      const codeAllocators = new Map<string, number>(); // Keeps track of slice index for each voucherId
      for (const voucherId of cumulativeQuantities.keys()) {
        codeAllocators.set(voucherId, 0);
      }

      const results: BatchTransferTaskResult[] = [];
      let successCount = 0;
      let failedCount = 0;

      // 6. Sequential Trace & On-chain execution loop
      for (let i = 0; i < transfers.length; i++) {
        const transfer = transfers[i];
        const { customerPhone, voucherId, quantity } = transfer;
        const customer = customerMap.get(customerPhone)!;
        const voucher = voucherMap.get(voucherId)!;
        const typeId = parseInt(voucher.tokenId!, 10);

        // Slice allocated codes for this transfer task
        const fullList = lockedVoucherCodesByVoucherId.get(voucherId)!;
        const startIndex = codeAllocators.get(voucherId)!;
        const allocatedCodes = fullList.slice(
          startIndex,
          startIndex + quantity,
        );
        codeAllocators.set(voucherId, startIndex + quantity);

        const voucherCodeIds = allocatedCodes.map((c) => c.id);

        try {
          this.logger.log(
            `[BatchJob ${batchJobId}] [Item ${i + 1}/${transfers.length}] Distributing ${quantity} x Voucher tokenId ${typeId} to customer ${customer.wallet!.walletAddress}`,
          );

          // Invoke single on-chain transfer
          const txHash = await this.blockchainService.transferCoupon(
            typeId,
            quantity,
            merchant.wallet.walletAddress,
            customer.wallet!.walletAddress,
            merchantPrivateKey,
          );

          // Update ownership & write activity logs in a Prisma $transaction
          const updatedTransactions = await writeDirectVoucherTransferLedger({
            prisma: this.prisma,
            voucherCodeIds,
            merchant,
            customer: { ...customer, wallet: customer.wallet! },
            voucher,
            txHash,
          });

          results.push({
            customerPhone,
            voucherId,
            quantity,
            status: 'SUCCESS',
            transactionHash: txHash,
            voucherCodeIds,
            transactionIds: updatedTransactions.map((tx) => tx.id),
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
