jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import { ExportDatabaseSql } from 'src/modules/internal/admin/handlers/export-database-sql.handler';

describe('ExportDatabaseSql', () => {
  let handler: ExportDatabaseSql;
  let prisma: any;

  beforeEach(() => {
    const findMany = jest.fn().mockResolvedValue([]);

    prisma = {
      transactionType: { findMany },
      wallet: { findMany },
      user: { findMany },
      merchant: { findMany },
      customer: { findMany },
      point: { findMany },
      merchantRefStore: { findMany },
      apiKey: { findMany },
      userMerchant: { findMany },
      customerMerChant: { findMany },
      voucher: { findMany },
      listingBatch: { findMany },
      voucherCode: { findMany },
      transaction: { findMany },
      customerPoint: { findMany },
      session: { findMany },
      treasury: { findMany },
      tempLinkCreateUser: { findMany },
      aisTransferLog: { findMany },
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
        transactionRefId: null,
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
    expect(sql).toContain(expectedByteaLiteral);
    expect(sql).toContain('COMMIT;');
  });
});
