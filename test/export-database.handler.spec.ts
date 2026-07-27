jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import { ExportDatabase } from 'src/modules/internal/admin/handlers/export-database.handler';

describe('ExportDatabase', () => {
  let handler: ExportDatabase;
  let prisma: any;

  beforeEach(() => {
    const empty = () => jest.fn().mockResolvedValue([]);

    prisma = {
      point: { findMany: empty() },
      user: { findMany: empty() },
      session: { findMany: empty() },
      userMerchant: { findMany: empty() },
      wallet: { findMany: empty() },
      merchant: { findMany: empty() },
      apiKey: { findMany: empty() },
      merchantRefStore: { findMany: empty() },
      transaction: { findMany: empty() },
      customer: { findMany: empty() },
      customerMerChant: { findMany: empty() },
      customerPoint: { findMany: empty() },
      transactionType: { findMany: empty() },
      voucher: { findMany: empty() },
      listingBatch: { findMany: empty() },
      directTransferOperation: { findMany: empty() },
      directTransferRecoveryRun: { findMany: empty() },
      directTransferOperationEvent: { findMany: empty() },
      voucherCode: { findMany: empty() },
      treasury: { findMany: empty() },
      tempLinkCreateUser: { findMany: empty() },
      aisTransferLog: { findMany: empty() },
    };

    handler = new ExportDatabase(prisma);
  });

  it('should export JSON file with counts and data', async () => {
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
      },
    ]);
    prisma.directTransferRecoveryRun.findMany.mockResolvedValue([
      { id: 'run-1', actorId: 'admin', status: 'COMPLETED' },
    ]);
    prisma.directTransferOperationEvent.findMany.mockResolvedValue([
      { id: 'event-1', operationId: 'operation-1', action: 'DB_FINALIZED' },
    ]);

    const result = await handler.execute();
    const json = JSON.parse(result.fileBuffer.toString('utf8'));

    expect(result.fileName).toMatch(/^database-export-.*\.json$/);
    expect(json.counts.wallets).toBe(1);
    expect(json.counts.transactions).toBe(1);
    expect(json.counts.directTransferRecoveryRuns).toBe(1);
    expect(json.counts.directTransferOperationEvents).toBe(1);
    expect(json.data.wallets[0].id).toBe('wallet-1');
    expect(json.data.transactions[0].txHash).toBe('0xabcd');
    expect(json.data.directTransferRecoveryRuns[0].actorId).toBe('admin');
  });
});
