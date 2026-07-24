jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import { BadRequestException, ConflictException } from '@nestjs/common';
import { RecoverDirectTransferOperationsHandler } from 'src/modules/internal/voucher/handlers/recoverDirectTransferOperations.handler';

describe('RecoverDirectTransferOperationsHandler manual recovery', () => {
  let prisma: any;
  let blockchainService: any;
  let handler: RecoverDirectTransferOperationsHandler;

  const submittedOperation = {
    id: 'operation-1',
    merchantId: 'merchant-1',
    customerId: 'customer-1',
    voucherId: 'voucher-1',
    quantity: 1,
    reservedVoucherCodeIds: ['code-1'],
    status: 'SUBMITTED',
    txHash: '0xSubmitted',
    createdAt: new Date('2026-07-24T08:00:00.000Z'),
    updatedAt: new Date('2026-07-24T08:01:00.000Z'),
    submittedAt: new Date('2026-07-24T08:01:00.000Z'),
  };

  beforeEach(() => {
    prisma = {
      directTransferOperation: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      directTransferRecoveryRun: {
        create: jest.fn().mockResolvedValue({ id: 'run-1' }),
        update: jest.fn().mockResolvedValue({}),
      },
      directTransferOperationEvent: {
        create: jest.fn().mockResolvedValue({ id: 'event-1' }),
      },
      voucherCode: {
        findMany: jest.fn(),
        count: jest.fn().mockResolvedValue(1),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      transaction: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({ id: 'transaction-1' }),
      },
      merchant: { findUnique: jest.fn() },
      customer: { findUnique: jest.fn() },
      voucher: { findUnique: jest.fn() },
      $transaction: jest.fn(async (callback: any) => callback(prisma)),
    };
    blockchainService = {
      getCouponTransferReceipt: jest.fn(),
      submitCouponTransfer: jest.fn(),
    };
    handler = new RecoverDirectTransferOperationsHandler(
      prisma,
      blockchainService,
    );
  });

  it('lists immediate failures and operations stale for more than the threshold', async () => {
    prisma.directTransferOperation.findMany.mockResolvedValue([
      submittedOperation,
    ]);

    const result = await handler.listNeedsAction({
      thresholdMinutes: 15,
      limit: 100,
    });

    const query = prisma.directTransferOperation.findMany.mock.calls[0][0];
    expect(query.where.OR).toEqual(
      expect.arrayContaining([
        { status: { in: ['DB_FAILED', 'MANUAL_REVIEW'] } },
        expect.objectContaining({ status: 'SUBMITTED' }),
        expect.objectContaining({ status: 'PREPARED' }),
      ]),
    );
    expect(result.needsActionCount).toBe(1);
    expect(result.operations[0]).toEqual(
      expect.objectContaining({
        operationId: 'operation-1',
        status: 'SUBMITTED',
      }),
    );
  });

  it('dry-runs a pending receipt without mutating the operation and records the check', async () => {
    prisma.directTransferOperation.findMany.mockResolvedValue([
      submittedOperation,
    ]);
    blockchainService.getCouponTransferReceipt.mockResolvedValue(null);

    const result = await handler.dryRun({
      operationIds: ['operation-1'],
      actorId: 'admin',
      reason: 'daily review',
    });

    expect(blockchainService.getCouponTransferReceipt).toHaveBeenCalledWith(
      '0xSubmitted',
    );
    expect(blockchainService.submitCouponTransfer).not.toHaveBeenCalled();
    expect(prisma.directTransferOperation.update).not.toHaveBeenCalled();
    expect(prisma.directTransferOperationEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        recoveryRunId: 'run-1',
        operationId: 'operation-1',
        actorType: 'ADMIN',
        actorId: 'admin',
        action: 'RECEIPT_CHECKED',
        fromStatus: 'SUBMITTED',
        toStatus: 'SUBMITTED',
      }),
    });
    expect(result.results[0].recommendedAction).toBe('WAIT');
  });

  it('executes only the DB finalization after a confirmed receipt', async () => {
    prisma.directTransferOperation.findMany.mockResolvedValue([
      submittedOperation,
    ]);
    blockchainService.getCouponTransferReceipt.mockResolvedValue({
      status: 1,
      hash: '0xSubmitted',
    });
    prisma.merchant.findUnique.mockResolvedValue({
      id: 'merchant-1',
      wallet: { walletAddress: '0xMerchant' },
    });
    prisma.customer.findUnique.mockResolvedValue({
      id: 'customer-1',
      wallet: { walletAddress: '0xCustomer' },
    });
    prisma.voucher.findUnique.mockResolvedValue({
      id: 'voucher-1',
      merchantRef: 'STORE-C',
    });

    const result = await handler.executeManual({
      operationIds: ['operation-1'],
      actorId: 'admin',
      reason: 'receipt confirmed',
    });

    expect(blockchainService.submitCouponTransfer).not.toHaveBeenCalled();
    expect(prisma.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sourcePool: 'WALLET_POOL',
          transactionRefId: 'operation-1',
        }),
      }),
    );
    expect(prisma.directTransferOperationEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        recoveryRunId: 'run-1',
        operationId: 'operation-1',
        action: 'DB_FINALIZED',
        fromStatus: 'SUBMITTED',
        toStatus: 'CONFIRMED',
        receiptStatus: 1,
      }),
    });
    expect(result.summary.confirmed).toBe(1);
  });

  it('does not release PREPARED through the generic execute endpoint', async () => {
    prisma.directTransferOperation.findMany.mockResolvedValue([
      { ...submittedOperation, status: 'PREPARED', txHash: null },
    ]);

    const result = await handler.executeManual({
      operationIds: ['operation-1'],
      actorId: 'admin',
      reason: 'daily review',
    });

    expect(prisma.voucherCode.updateMany).not.toHaveBeenCalled();
    expect(result.results[0].recommendedAction).toBe('INVESTIGATE_SUBMISSION');
  });

  it('refuses an explicit PREPARED release when a ledger transaction already exists', async () => {
    prisma.directTransferOperation.findUnique.mockResolvedValue({
      ...submittedOperation,
      status: 'PREPARED',
      txHash: null,
    });
    prisma.transaction.count.mockResolvedValue(1);

    await expect(
      handler.releasePrepared({
        operationId: 'operation-1',
        actorId: 'admin',
        reason: 'verified no submission',
        evidence: 'RPC receipt and explorer search returned no transaction',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('explicitly releases a verified PREPARED operation and writes an atomic audit event', async () => {
    prisma.directTransferOperation.findUnique.mockResolvedValue({
      ...submittedOperation,
      status: 'PREPARED',
      txHash: null,
    });
    prisma.voucherCode.findMany.mockResolvedValue([
      {
        id: 'code-1',
        currentOwnerId: 'merchant-1',
        currentOwnerType: 'MERCHANT',
        directTransferOperationId: 'operation-1',
      },
    ]);

    const result = await handler.releasePrepared({
      operationId: 'operation-1',
      actorId: 'admin',
      reason: 'verified no blockchain submission',
      evidence: 'RPC receipt and explorer search returned no transaction',
    });

    expect(prisma.voucherCode.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['code-1'] },
        currentOwnerId: 'merchant-1',
        currentOwnerType: 'MERCHANT',
        directTransferOperationId: 'operation-1',
      },
      data: { directTransferOperationId: null },
    });
    expect(prisma.directTransferOperationEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        recoveryRunId: 'run-1',
        operationId: 'operation-1',
        actorType: 'ADMIN',
        action: 'CLAIM_RELEASED',
        fromStatus: 'PREPARED',
        toStatus: 'CHAIN_FAILED',
        metadata: expect.objectContaining({
          evidence: 'RPC receipt and explorer search returned no transaction',
        }),
      }),
    });
    expect(result.status).toBe('CHAIN_FAILED');
  });

  it('requires an audit reason for every manual mutation', async () => {
    await expect(
      handler.executeManual({
        operationIds: ['operation-1'],
        actorId: 'admin',
        reason: ' ',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a selection when any requested operation does not exist', async () => {
    prisma.directTransferOperation.findMany.mockResolvedValue([
      submittedOperation,
    ]);

    await expect(
      handler.dryRun({
        operationIds: ['operation-1', 'missing-operation'],
        actorId: 'admin',
        reason: 'daily review',
      }),
    ).rejects.toThrow('Direct Transfer operation not found: missing-operation');
    expect(prisma.directTransferRecoveryRun.create).not.toHaveBeenCalled();
  });

  it('sends a confirmed receipt with partial DB state to manual review', async () => {
    prisma.directTransferOperation.findMany.mockResolvedValue([
      submittedOperation,
    ]);
    blockchainService.getCouponTransferReceipt.mockResolvedValue({ status: 1 });
    prisma.transaction.findMany.mockResolvedValue([
      {
        voucherCodeId: 'code-1',
        txHash: Buffer.from('abcd', 'hex'),
      },
    ]);
    prisma.voucherCode.findMany.mockResolvedValue([
      {
        id: 'code-1',
        currentOwnerId: 'merchant-1',
        currentOwnerType: 'MERCHANT',
        directTransferOperationId: 'operation-1',
      },
    ]);

    const result = await handler.executeManual({
      operationIds: ['operation-1'],
      actorId: 'admin',
      reason: 'confirmed receipt needs reconciliation',
    });

    expect(result.results[0].recommendedAction).toBe('MANUAL_REVIEW');
    expect(prisma.transaction.create).not.toHaveBeenCalled();
    expect(prisma.voucherCode.updateMany).not.toHaveBeenCalled();
    expect(prisma.directTransferOperation.update).toHaveBeenCalledWith({
      where: { id: 'operation-1' },
      data: expect.objectContaining({ status: 'MANUAL_REVIEW' }),
    });
    expect(prisma.directTransferOperationEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'MARKED_MANUAL_REVIEW',
        fromStatus: 'SUBMITTED',
        toStatus: 'MANUAL_REVIEW',
      }),
    });
  });

  it('requires separate evidence for explicit PREPARED release', async () => {
    await expect(
      handler.releasePrepared({
        operationId: 'operation-1',
        actorId: 'admin',
        reason: 'verified no submission',
        evidence: ' ',
      }),
    ).rejects.toThrow('Release evidence is required');
  });

  it('does not release a PREPARED operation younger than 15 minutes', async () => {
    prisma.directTransferOperation.findUnique.mockResolvedValue({
      ...submittedOperation,
      status: 'PREPARED',
      txHash: null,
      createdAt: new Date(),
    });

    await expect(
      handler.releasePrepared({
        operationId: 'operation-1',
        actorId: 'admin',
        reason: 'verified no submission',
        evidence: 'RPC and explorer checked',
      }),
    ).rejects.toThrow(
      'PREPARED operation must be at least 15 minutes old before release',
    );
    expect(prisma.voucherCode.updateMany).not.toHaveBeenCalled();
  });
});
