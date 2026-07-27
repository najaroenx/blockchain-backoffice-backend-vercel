import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';
import {
  releaseDirectTransferOperation,
  writeDirectVoucherTransferLedger,
} from '../utils/direct-voucher-transfer.util';

export type RecommendedAction =
  | 'FINALIZE_DB'
  | 'MARK_CONFIRMED_ONLY'
  | 'RELEASE_CLAIM'
  | 'WAIT'
  | 'INVESTIGATE_SUBMISSION'
  | 'NO_ACTION'
  | 'MANUAL_REVIEW';

interface ManualRecoveryInput {
  operationIds: string[];
  actorId: string;
  reason: string;
}

export interface InspectionResult {
  operationId: string;
  currentStatus: string;
  txHash: string | null;
  receiptStatus: number | null;
  recommendedAction: RecommendedAction;
  error?: string;
}

export interface RecoverySummary {
  inspected: number;
  confirmed: number;
  released: number;
  pending: number;
  failed: number;
}

@Injectable()
export class RecoverDirectTransferOperationsHandler {
  private readonly logger = new Logger(
    RecoverDirectTransferOperationsHandler.name,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly blockchainService: BlockchainService,
  ) {}

  async listNeedsAction(params?: {
    thresholdMinutes?: number;
    limit?: number;
  }) {
    const thresholdMinutes = this.normalizeThreshold(
      params?.thresholdMinutes ?? 15,
    );
    const limit = this.normalizeLimit(params?.limit ?? 100);
    const checkedAt = new Date();
    const staleBefore = new Date(
      checkedAt.getTime() - thresholdMinutes * 60 * 1000,
    );
    const operations = await this.prisma.directTransferOperation.findMany({
      where: {
        OR: [
          { status: { in: ['DB_FAILED', 'MANUAL_REVIEW'] } },
          {
            status: 'SUBMITTED',
            submittedAt: { lt: staleBefore },
          },
          {
            status: 'PREPARED',
            createdAt: { lt: staleBefore },
          },
        ],
      },
      orderBy: { updatedAt: 'asc' },
      take: limit,
    });

    return {
      checkedAt: checkedAt.toISOString(),
      thresholdMinutes,
      needsActionCount: operations.length,
      operations: operations.map((operation) => ({
        operationId: operation.id,
        status: operation.status,
        merchantId: operation.merchantId,
        customerId: operation.customerId,
        voucherId: operation.voucherId,
        quantity: operation.quantity,
        reservedVoucherCodeIds: operation.reservedVoucherCodeIds,
        txHash: operation.txHash,
        errorNote: operation.errorNote,
        ageMinutes: Math.max(
          0,
          Math.floor(
            (checkedAt.getTime() - operation.updatedAt.getTime()) / 60000,
          ),
        ),
        createdAt: operation.createdAt,
        updatedAt: operation.updatedAt,
      })),
    };
  }

  async dryRun(input: ManualRecoveryInput) {
    this.validateSelection(input, true);
    const operations = await this.findSelectedOperations(input.operationIds);
    const run = await this.createRun(input, `Dry-run: ${input.reason}`);
    const results: InspectionResult[] = [];
    let failed = 0;

    for (const operation of operations) {
      try {
        const inspection = await this.inspectOperation(operation);
        results.push(inspection);
        await this.recordEvent({
          runId: run.id,
          operation,
          actorId: input.actorId,
          action:
            inspection.receiptStatus === null &&
            inspection.recommendedAction !== 'WAIT'
              ? 'NO_CHANGE'
              : 'RECEIPT_CHECKED',
          receiptStatus: inspection.receiptStatus,
          metadata: {
            reason: input.reason,
            recommendedAction: inspection.recommendedAction,
            dryRun: true,
          },
        });
      } catch (error) {
        failed++;
        results.push({
          operationId: operation.id,
          currentStatus: operation.status,
          txHash: operation.txHash,
          receiptStatus: null,
          recommendedAction: 'MANUAL_REVIEW',
          error: error.message,
        });
        await this.recordErrorEvent(run.id, operation, input, error);
      }
    }

    const summary = this.summarizeInspections(results, failed);
    await this.finishRun(run.id, summary);
    return { runId: run.id, summary, results };
  }

  async executeManual(input: ManualRecoveryInput) {
    this.validateSelection(input, true);
    const operations = await this.findSelectedOperations(input.operationIds);
    const run = await this.createRun(input, input.reason);
    const results: InspectionResult[] = [];
    const summary: RecoverySummary = {
      inspected: operations.length,
      confirmed: 0,
      released: 0,
      pending: 0,
      failed: 0,
    };

    for (const operation of operations) {
      try {
        const inspection = await this.inspectOperation(operation);
        results.push(inspection);

        if (inspection.recommendedAction === 'FINALIZE_DB') {
          await this.finalizeDatabase(run.id, operation, input, inspection);
          summary.confirmed++;
        } else if (inspection.recommendedAction === 'MARK_CONFIRMED_ONLY') {
          await this.markAlreadyConfirmed(run.id, operation, input, inspection);
          summary.confirmed++;
        } else if (inspection.recommendedAction === 'RELEASE_CLAIM') {
          await releaseDirectTransferOperation(
            this.prisma,
            operation.id,
            new Error(`Confirmed reverted transaction ${inspection.txHash}`),
            {
              recoveryRunId: run.id,
              actorType: 'ADMIN',
              actorId: input.actorId,
              action: 'CLAIM_RELEASED',
              fromStatus: operation.status,
              txHash: inspection.txHash ?? undefined,
              receiptStatus: inspection.receiptStatus ?? undefined,
              metadata: {
                reason: input.reason,
                receiptStatus: inspection.receiptStatus,
              },
            },
          );
          summary.released++;
        } else if (inspection.recommendedAction === 'MANUAL_REVIEW') {
          await this.markManualReview(run.id, operation, input, inspection);
          summary.pending++;
        } else {
          await this.recordEvent({
            runId: run.id,
            operation,
            actorId: input.actorId,
            action:
              inspection.recommendedAction === 'WAIT'
                ? 'RECEIPT_CHECKED'
                : 'NO_CHANGE',
            receiptStatus: inspection.receiptStatus,
            metadata: {
              reason: input.reason,
              recommendedAction: inspection.recommendedAction,
            },
          });
          summary.pending++;
        }
      } catch (error) {
        summary.failed++;
        await this.recordErrorEvent(run.id, operation, input, error);
      }
    }

    await this.finishRun(run.id, summary);
    return { runId: run.id, summary, results };
  }

  async releasePrepared(input: {
    operationId: string;
    actorId: string;
    reason: string;
    evidence: string;
  }) {
    this.validateSelection(
      {
        operationIds: [input.operationId],
        actorId: input.actorId,
        reason: input.reason,
      },
      true,
    );
    if (!input.evidence?.trim()) {
      throw new BadRequestException('Release evidence is required');
    }
    const operation = await this.prisma.directTransferOperation.findUnique({
      where: { id: input.operationId },
    });
    if (!operation) {
      throw new NotFoundException('Direct Transfer operation not found');
    }
    if (operation.status !== 'PREPARED' || operation.txHash) {
      throw new ConflictException(
        'Only PREPARED operations without a tx hash can use explicit release',
      );
    }
    const staleBefore = Date.now() - 15 * 60 * 1000;
    if (operation.createdAt.getTime() >= staleBefore) {
      throw new ConflictException(
        'PREPARED operation must be at least 15 minutes old before release',
      );
    }

    const [existingTransactions, claimedCodeCount] = await Promise.all([
      this.prisma.transaction.count({
        where: { transactionRefId: operation.id },
      }),
      this.prisma.voucherCode.count({
        where: { directTransferOperationId: operation.id },
      }),
    ]);
    if (existingTransactions > 0) {
      throw new ConflictException(
        'Cannot release PREPARED operation with an existing ledger transaction',
      );
    }
    if (claimedCodeCount !== operation.reservedVoucherCodeIds.length) {
      throw new ConflictException(
        'Claimed VoucherCode count does not match the PREPARED operation',
      );
    }

    const reservedCodes = await this.prisma.voucherCode.findMany({
      where: { id: { in: operation.reservedVoucherCodeIds } },
    });
    const reservationMatches =
      reservedCodes.length === operation.reservedVoucherCodeIds.length &&
      reservedCodes.every(
        (code) =>
          code.currentOwnerId === operation.merchantId &&
          code.currentOwnerType === 'MERCHANT' &&
          code.directTransferOperationId === operation.id,
      );
    if (!reservationMatches) {
      throw new ConflictException(
        'Reserved VoucherCode state does not match the PREPARED operation',
      );
    }

    const run = await this.createRun(
      {
        operationIds: [operation.id],
        actorId: input.actorId,
        reason: input.reason,
      },
      input.reason,
    );

    try {
      await this.prisma.$transaction(async (tx) => {
        const operationUpdate = await tx.directTransferOperation.updateMany({
          where: {
            id: operation.id,
            status: 'PREPARED',
            txHash: null,
          },
          data: {
            status: 'CHAIN_FAILED',
            errorNote: input.reason,
          },
        });
        if (operationUpdate.count !== 1) {
          throw new ConflictException(
            'Operation changed while preparing the release',
          );
        }
        const releasedClaims = await tx.voucherCode.updateMany({
          where: {
            id: { in: operation.reservedVoucherCodeIds },
            currentOwnerId: operation.merchantId,
            currentOwnerType: 'MERCHANT',
            directTransferOperationId: operation.id,
          },
          data: { directTransferOperationId: null },
        });
        if (releasedClaims.count !== operation.reservedVoucherCodeIds.length) {
          throw new ConflictException(
            'VoucherCode claims changed while preparing the release',
          );
        }
        await tx.directTransferOperationEvent.create({
          data: {
            recoveryRunId: run.id,
            operationId: operation.id,
            actorType: 'ADMIN',
            actorId: input.actorId,
            action: 'CLAIM_RELEASED',
            fromStatus: 'PREPARED',
            toStatus: 'CHAIN_FAILED',
            errorNote: input.reason,
            metadata: {
              reason: input.reason,
              evidence: input.evidence,
              explicitApproval: true,
            },
          },
        });
      });
      const summary: RecoverySummary = {
        inspected: 1,
        confirmed: 0,
        released: 1,
        pending: 0,
        failed: 0,
      };
      await this.finishRun(run.id, summary);
      return {
        runId: run.id,
        operationId: operation.id,
        status: 'CHAIN_FAILED',
      };
    } catch (error) {
      await this.failRun(run.id, error);
      throw error;
    }
  }

  private async inspectOperation(operation: any): Promise<InspectionResult> {
    if (['CONFIRMED', 'CHAIN_FAILED'].includes(operation.status)) {
      return this.inspection(operation, null, 'NO_ACTION');
    }

    if (operation.status === 'PREPARED' && !operation.txHash) {
      const databaseState = await this.getDatabaseState(operation);
      if (databaseState.partial || databaseState.transactionHashMismatch) {
        return this.inspection(operation, null, 'MANUAL_REVIEW');
      }
      if (databaseState.complete && databaseState.txHash) {
        const receipt = await this.blockchainService.getCouponTransferReceipt(
          databaseState.txHash,
        );
        return this.inspection(
          { ...operation, txHash: databaseState.txHash },
          receipt ? Number(receipt.status) : null,
          receipt && Number(receipt.status) === 1
            ? 'MARK_CONFIRMED_ONLY'
            : 'MANUAL_REVIEW',
        );
      }
      return this.inspection(operation, null, 'INVESTIGATE_SUBMISSION');
    }

    if (!operation.txHash) {
      return this.inspection(operation, null, 'MANUAL_REVIEW');
    }

    const receipt = await this.blockchainService.getCouponTransferReceipt(
      operation.txHash,
    );
    if (!receipt) {
      return this.inspection(operation, null, 'WAIT');
    }
    const receiptStatus = Number(receipt.status);
    if (receiptStatus !== 1) {
      return this.inspection(operation, receiptStatus, 'RELEASE_CLAIM');
    }

    const databaseState = await this.getDatabaseState(operation);
    if (databaseState.partial || databaseState.transactionHashMismatch) {
      return this.inspection(operation, receiptStatus, 'MANUAL_REVIEW');
    }
    return this.inspection(
      operation,
      receiptStatus,
      databaseState.complete ? 'MARK_CONFIRMED_ONLY' : 'FINALIZE_DB',
    );
  }

  private async getDatabaseState(operation: any) {
    const [transactions, voucherCodes] = await Promise.all([
      this.prisma.transaction.findMany({
        where: {
          transactionRefId: operation.id,
          type: 'VOUCHER',
          transactionTypeId: 'TRANSFER',
        },
      }),
      this.prisma.voucherCode.findMany({
        where: { id: { in: operation.reservedVoucherCodeIds } },
      }),
    ]);
    const transactionRows = transactions ?? [];
    const codeRows = voucherCodes ?? [];
    const transactionCodeIds = new Set(
      transactionRows.map((transaction) => transaction.voucherCodeId),
    );
    const complete =
      transactionRows.length === operation.quantity &&
      operation.reservedVoucherCodeIds.every((id) =>
        transactionCodeIds.has(id),
      ) &&
      codeRows.length === operation.quantity &&
      codeRows.every(
        (code) =>
          code.currentOwnerId === operation.customerId &&
          code.currentOwnerType === 'CUSTOMER' &&
          code.directTransferOperationId === operation.id,
      );
    const transactionHashes = transactionRows
      .map((transaction) =>
        transaction.txHash
          ? this.toHex(transaction.txHash).toLowerCase()
          : null,
      )
      .filter((txHash): txHash is string => Boolean(txHash));
    const uniqueTransactionHashes = new Set(transactionHashes);
    const operationHash = operation.txHash?.toLowerCase();
    const transactionHashMismatch =
      transactionRows.length > 0 &&
      (transactionHashes.length !== transactionRows.length ||
        uniqueTransactionHashes.size !== 1 ||
        (operationHash &&
          !uniqueTransactionHashes.has(operationHash.toLowerCase())));
    const firstHash = transactionRows[0]?.txHash;
    return {
      complete,
      partial:
        !complete &&
        (transactionRows.length > 0 ||
          codeRows.some((code) => code.currentOwnerType === 'CUSTOMER')),
      transactionHashMismatch,
      txHash: firstHash ? this.toHex(firstHash) : operation.txHash,
    };
  }

  private async finalizeDatabase(
    runId: string,
    operation: any,
    input: ManualRecoveryInput,
    inspection: InspectionResult,
  ) {
    const [merchant, customer, voucher] = await Promise.all([
      this.prisma.merchant.findUnique({
        where: { id: operation.merchantId },
        include: { wallet: true },
      }),
      this.prisma.customer.findUnique({
        where: { id: operation.customerId },
        include: { wallet: true },
      }),
      this.prisma.voucher.findUnique({
        where: { id: operation.voucherId },
      }),
    ]);
    if (!merchant?.wallet || !customer?.wallet || !voucher) {
      throw new Error(
        `Recovery participants missing for operation ${operation.id}`,
      );
    }
    await writeDirectVoucherTransferLedger({
      prisma: this.prisma,
      voucherCodeIds: operation.reservedVoucherCodeIds,
      merchant,
      customer,
      voucher,
      txHash: inspection.txHash!,
      operationId: operation.id,
      auditContext: {
        recoveryRunId: runId,
        actorType: 'ADMIN',
        actorId: input.actorId,
        action: 'DB_FINALIZED',
        fromStatus: operation.status,
        receiptStatus: inspection.receiptStatus ?? undefined,
        metadata: {
          reason: input.reason,
          receiptStatus: inspection.receiptStatus,
        },
      },
    });
  }

  private async markAlreadyConfirmed(
    runId: string,
    operation: any,
    input: ManualRecoveryInput,
    inspection: InspectionResult,
  ) {
    await this.prisma.$transaction(async (tx) => {
      await tx.directTransferOperation.update({
        where: { id: operation.id },
        data: {
          status: 'CONFIRMED',
          txHash: inspection.txHash,
          confirmedAt: new Date(),
        },
      });
      await tx.directTransferOperationEvent.create({
        data: {
          recoveryRunId: runId,
          operationId: operation.id,
          actorType: 'ADMIN',
          actorId: input.actorId,
          action: 'OPERATION_CONFIRMED',
          fromStatus: operation.status,
          toStatus: 'CONFIRMED',
          txHash: inspection.txHash,
          receiptStatus: inspection.receiptStatus,
          metadata: {
            reason: input.reason,
            reconciliation: 'DATABASE_ALREADY_COMPLETE',
          },
        },
      });
    });
  }

  private async markManualReview(
    runId: string,
    operation: any,
    input: ManualRecoveryInput,
    inspection: InspectionResult,
  ) {
    await this.prisma.$transaction(async (tx) => {
      await tx.directTransferOperation.update({
        where: { id: operation.id },
        data: {
          status: 'MANUAL_REVIEW',
          errorNote:
            'Manual recovery found partial or inconsistent database state',
        },
      });
      await tx.directTransferOperationEvent.create({
        data: {
          recoveryRunId: runId,
          operationId: operation.id,
          actorType: 'ADMIN',
          actorId: input.actorId,
          action: 'MARKED_MANUAL_REVIEW',
          fromStatus: operation.status,
          toStatus: 'MANUAL_REVIEW',
          txHash: inspection.txHash,
          receiptStatus: inspection.receiptStatus,
          metadata: {
            reason: input.reason,
            recommendedAction: inspection.recommendedAction,
          },
        },
      });
    });
  }

  private async findSelectedOperations(operationIds: string[]) {
    const uniqueOperationIds = [...new Set(operationIds)];
    const operations = await this.prisma.directTransferOperation.findMany({
      where: { id: { in: uniqueOperationIds } },
      orderBy: { createdAt: 'asc' },
    });
    if (operations.length !== uniqueOperationIds.length) {
      const foundIds = new Set(operations.map((operation) => operation.id));
      const missingIds = uniqueOperationIds.filter((id) => !foundIds.has(id));
      throw new NotFoundException(
        `Direct Transfer operation not found: ${missingIds.join(', ')}`,
      );
    }
    return operations;
  }

  private async createRun(input: ManualRecoveryInput, reason: string) {
    return this.prisma.directTransferRecoveryRun.create({
      data: {
        status: 'RUNNING',
        actorId: input.actorId,
        reason,
        inspectedCount: 0,
      },
    });
  }

  private async finishRun(runId: string, summary: RecoverySummary) {
    await this.prisma.directTransferRecoveryRun.update({
      where: { id: runId },
      data: {
        status:
          summary.failed === 0
            ? 'COMPLETED'
            : summary.failed < summary.inspected
              ? 'PARTIAL_FAILED'
              : 'FAILED',
        finishedAt: new Date(),
        inspectedCount: summary.inspected,
        confirmedCount: summary.confirmed,
        releasedCount: summary.released,
        pendingCount: summary.pending,
        failedCount: summary.failed,
      },
    });
  }

  private async failRun(runId: string, error: unknown) {
    await this.prisma.directTransferRecoveryRun.update({
      where: { id: runId },
      data: {
        status: 'FAILED',
        finishedAt: new Date(),
        failedCount: 1,
        errorNote: error instanceof Error ? error.message : String(error),
      },
    });
  }

  private async recordEvent(params: {
    runId: string;
    operation: any;
    actorId: string;
    action: 'RECEIPT_CHECKED' | 'NO_CHANGE';
    receiptStatus: number | null;
    metadata: Record<string, unknown>;
  }) {
    await this.prisma.directTransferOperationEvent.create({
      data: {
        recoveryRunId: params.runId,
        operationId: params.operation.id,
        actorType: 'ADMIN',
        actorId: params.actorId,
        action: params.action,
        fromStatus: params.operation.status,
        toStatus: params.operation.status,
        txHash: params.operation.txHash,
        receiptStatus: params.receiptStatus,
        metadata: params.metadata as any,
      },
    });
  }

  private async recordErrorEvent(
    runId: string,
    operation: any,
    input: ManualRecoveryInput,
    error: unknown,
  ) {
    const errorNote = error instanceof Error ? error.message : String(error);
    this.logger.error(
      `Manual recovery failed for operation ${operation.id}: ${errorNote}`,
    );
    await this.prisma.directTransferOperationEvent.create({
      data: {
        recoveryRunId: runId,
        operationId: operation.id,
        actorType: 'ADMIN',
        actorId: input.actorId,
        action: 'ERROR',
        fromStatus: operation.status,
        toStatus: operation.status,
        txHash: operation.txHash,
        errorNote,
        metadata: { reason: input.reason } as any,
      },
    });
  }

  private summarizeInspections(
    results: InspectionResult[],
    failed: number,
  ): RecoverySummary {
    return {
      inspected: results.length,
      confirmed: 0,
      released: 0,
      pending: results.length - failed,
      failed,
    };
  }

  private inspection(
    operation: any,
    receiptStatus: number | null,
    recommendedAction: RecommendedAction,
  ): InspectionResult {
    return {
      operationId: operation.id,
      currentStatus: operation.status,
      txHash: operation.txHash ?? null,
      receiptStatus,
      recommendedAction,
    };
  }

  private validateSelection(
    input: ManualRecoveryInput,
    requireReason: boolean,
  ) {
    if (!input.operationIds?.length) {
      throw new BadRequestException('At least one operationId is required');
    }
    if (input.operationIds.length > 100) {
      throw new BadRequestException(
        'Manual recovery supports at most 100 operations per run',
      );
    }
    if (!input.actorId?.trim()) {
      throw new BadRequestException('Admin actor is required');
    }
    if (requireReason && !input.reason?.trim()) {
      throw new BadRequestException('Recovery reason is required');
    }
  }

  private normalizeThreshold(value: number) {
    if (!Number.isInteger(value) || value < 1 || value > 1440) {
      throw new BadRequestException(
        'thresholdMinutes must be between 1 and 1440',
      );
    }
    return value;
  }

  private normalizeLimit(value: number) {
    if (!Number.isInteger(value) || value < 1 || value > 500) {
      throw new BadRequestException('limit must be between 1 and 500');
    }
    return value;
  }

  private toHex(value: Uint8Array | Buffer | string) {
    if (typeof value === 'string') {
      return value.startsWith('0x') ? value : `0x${value}`;
    }
    return `0x${Buffer.from(value).toString('hex')}`;
  }
}
