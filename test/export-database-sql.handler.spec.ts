jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import { ExportDatabaseSql } from 'src/modules/internal/admin/handlers/export-database-sql.handler';

describe('ExportDatabaseSql', () => {
  let handler: ExportDatabaseSql;
  let prisma: any;

  beforeEach(() => {
    const empty = () => jest.fn().mockResolvedValue([]);

    prisma = {
      transactionType: { findMany: empty() },
      wallet: { findMany: empty() },
      user: { findMany: empty() },
      merchant: { findMany: empty() },
      customer: { findMany: empty() },
      point: { findMany: empty() },
      merchantRefStore: { findMany: empty() },
      apiKey: { findMany: empty() },
      userMerchant: { findMany: empty() },
      customerMerChant: { findMany: empty() },
      voucher: { findMany: empty() },
      listingBatch: { findMany: empty() },
      directTransferOperation: { findMany: empty() },
      directTransferRecoveryRun: { findMany: empty() },
      directTransferOperationEvent: { findMany: empty() },
      voucherCode: { findMany: empty() },
      transaction: { findMany: empty() },
      customerPoint: { findMany: empty() },
      session: { findMany: empty() },
      treasury: { findMany: empty() },
      tempLinkCreateUser: { findMany: empty() },
      aisTransferLog: { findMany: empty() },
    };

    handler = new ExportDatabaseSql(prisma);
  });

  it('should export SQL file with truncate and insert statements', async () => {
    prisma.wallet.findMany.mockResolvedValue([
      {
        id: 'wallet-1',
        walletAddress: '0xabc',
        seedPhrase: 'encrypted-seed',
        chainCode: 'encrypted-chain',
        derivationIndex: 1,
        email: '',
        phoneNumber: '0812345678',
        type: 'customer',
        status: 'active',
      },
    ]);
    prisma.transaction.findMany.mockResolvedValue([
      {
        id: 'tx-1',
        txHash: Buffer.from('abcd', 'hex'),
        senderAddress: Buffer.from('01', 'hex'),
        receiverAddress: Buffer.from('02', 'hex'),
        amount: 100,
        eventId: null,
        createdAt: new Date('2026-03-27T10:00:00.000Z'),
        updatedAt: new Date('2026-03-27T10:00:00.000Z'),
        merchantId: null,
        merchantRef: null,
        pointId: null,
        transactionTypeId: null,
        voucherCodeId: null,
        senderId: null,
        senderType: null,
        receiverId: null,
        receiverType: null,
        type: null,
        sourcePool: 'WALLET_POOL',
        transactionRefId: null,
      },
    ]);
    prisma.directTransferOperation.findMany.mockResolvedValue([
      {
        id: 'operation-1',
        merchantId: 'merchant-1',
        customerId: 'customer-1',
        voucherId: 'voucher-1',
        quantity: 1,
        reservedVoucherCodeIds: ['code-1'],
        sourcePool: 'WALLET_POOL',
        status: 'CONFIRMED',
        txHash: '0xabcd',
        errorNote: null,
        submittedAt: new Date('2026-03-27T10:00:00.000Z'),
        confirmedAt: new Date('2026-03-27T10:00:10.000Z'),
        createdAt: new Date('2026-03-27T10:00:00.000Z'),
        updatedAt: new Date('2026-03-27T10:00:10.000Z'),
      },
    ]);
    prisma.directTransferRecoveryRun.findMany.mockResolvedValue([
      {
        id: 'run-1',
        status: 'COMPLETED',
        actorId: 'admin',
        reason: 'incident review',
        startedAt: new Date('2026-03-27T10:01:00.000Z'),
        finishedAt: new Date('2026-03-27T10:02:00.000Z'),
        inspectedCount: 1,
        confirmedCount: 1,
        releasedCount: 0,
        pendingCount: 0,
        failedCount: 0,
        errorNote: null,
      },
    ]);
    prisma.directTransferOperationEvent.findMany.mockResolvedValue([
      {
        id: 'event-1',
        recoveryRunId: 'run-1',
        operationId: 'operation-1',
        actorType: 'ADMIN',
        actorId: 'admin',
        action: 'DB_FINALIZED',
        fromStatus: 'DB_FAILED',
        toStatus: 'CONFIRMED',
        txHash: '0xabcd',
        receiptStatus: 1,
        errorNote: null,
        metadata: { reason: 'incident review' },
        createdAt: new Date('2026-03-27T10:02:00.000Z'),
      },
    ]);

    const result = await handler.execute();
    const sql = result.fileBuffer.toString('utf8');
    const expectedByteaLiteral = `'` + String.raw`\xabcd` + `'`;

    expect(result.fileName).toMatch(/^database-export-.*\.sql$/);
    expect(sql).toContain('BEGIN;');
    expect(sql).toContain('TRUNCATE TABLE');
    expect(sql).toContain('INSERT INTO "Wallet"');
    expect(sql).toContain("'encrypted-seed'");
    expect(sql).toContain('INSERT INTO "Transaction"');
    expect(sql).toContain('INSERT INTO "DirectTransferOperation"');
    expect(sql).toContain('INSERT INTO "DirectTransferRecoveryRun"');
    expect(sql).toContain('INSERT INTO "DirectTransferOperationEvent"');
    expect(sql).toContain('"sourcePool"');
    expect(sql).toContain(expectedByteaLiteral);
    expect(sql).toContain('COMMIT;');
  });
});
