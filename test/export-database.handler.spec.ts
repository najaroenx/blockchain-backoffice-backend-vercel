jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import { ExportDatabase } from 'src/modules/internal/admin/handlers/export-database.handler';

describe('ExportDatabase', () => {
  let handler: ExportDatabase;
  let prisma: any;

  beforeEach(() => {
    const findMany = jest.fn().mockResolvedValue([]);

    prisma = {
      point: { findMany },
      user: { findMany },
      session: { findMany },
      userMerchant: { findMany },
      wallet: { findMany },
      merchant: { findMany },
      apiKey: { findMany },
      merchantRefStore: { findMany },
      transaction: { findMany },
      customer: { findMany },
      customerMerChant: { findMany },
      customerPoint: { findMany },
      transactionType: { findMany },
      voucher: { findMany },
      listingBatch: { findMany },
      voucherCode: { findMany },
      treasury: { findMany },
      tempLinkCreateUser: { findMany },
      aisTransferLog: { findMany },
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

    const result = await handler.execute();
    const json = JSON.parse(result.fileBuffer.toString('utf8'));

    expect(result.fileName).toMatch(/^database-export-.*\.json$/);
    expect(json.counts.wallets).toBe(1);
    expect(json.counts.transactions).toBe(1);
    expect(json.data.wallets[0].id).toBe('wallet-1');
    expect(json.data.transactions[0].txHash).toBe('0xabcd');
  });
});
