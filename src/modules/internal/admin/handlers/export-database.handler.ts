import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class ExportDatabase {
  private readonly logger = new Logger(ExportDatabase.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(): Promise<{
    fileBuffer: Buffer;
    fileName: string;
  }> {
    const exportedAt = new Date();

    this.logger.warn(
      '[Admin Export] Exporting full database contents including sensitive fields',
    );

    const [
      points,
      users,
      sessions,
      userMerchants,
      wallets,
      merchants,
      apiKeys,
      merchantRefStores,
      transactions,
      customers,
      customerMerChants,
      customerPoints,
      transactionTypes,
      vouchers,
      listingBatches,
      voucherCodes,
      treasuries,
      tempLinkCreateUsers,
      aisTransferLogs,
    ] = await Promise.all([
      this.prisma.point.findMany({ orderBy: { id: 'asc' } }),
      this.prisma.user.findMany({ orderBy: { id: 'asc' } }),
      this.prisma.session.findMany({ orderBy: { id: 'asc' } }),
      this.prisma.userMerchant.findMany({ orderBy: { id: 'asc' } }),
      this.prisma.wallet.findMany({ orderBy: { id: 'asc' } }),
      this.prisma.merchant.findMany({ orderBy: { id: 'asc' } }),
      this.prisma.apiKey.findMany({ orderBy: { id: 'asc' } }),
      this.prisma.merchantRefStore.findMany({ orderBy: { id: 'asc' } }),
      this.prisma.transaction.findMany({ orderBy: { id: 'asc' } }),
      this.prisma.customer.findMany({ orderBy: { id: 'asc' } }),
      this.prisma.customerMerChant.findMany({ orderBy: { id: 'asc' } }),
      this.prisma.customerPoint.findMany({ orderBy: { id: 'asc' } }),
      this.prisma.transactionType.findMany({ orderBy: { id: 'asc' } }),
      this.prisma.voucher.findMany({ orderBy: { id: 'asc' } }),
      this.prisma.listingBatch.findMany({ orderBy: { id: 'asc' } }),
      this.prisma.voucherCode.findMany({ orderBy: { id: 'asc' } }),
      this.prisma.treasury.findMany({ orderBy: { id: 'asc' } }),
      this.prisma.tempLinkCreateUser.findMany({ orderBy: { id: 'asc' } }),
      this.prisma.aisTransferLog.findMany({ orderBy: { id: 'asc' } }),
    ]);

    const payload = {
      exportedAt: exportedAt.toISOString(),
      counts: {
        points: points.length,
        users: users.length,
        sessions: sessions.length,
        userMerchants: userMerchants.length,
        wallets: wallets.length,
        merchants: merchants.length,
        apiKeys: apiKeys.length,
        merchantRefStores: merchantRefStores.length,
        transactions: transactions.length,
        customers: customers.length,
        customerMerChants: customerMerChants.length,
        customerPoints: customerPoints.length,
        transactionTypes: transactionTypes.length,
        vouchers: vouchers.length,
        listingBatches: listingBatches.length,
        voucherCodes: voucherCodes.length,
        treasuries: treasuries.length,
        tempLinkCreateUsers: tempLinkCreateUsers.length,
        aisTransferLogs: aisTransferLogs.length,
      },
      data: this.serializeValue({
        points,
        users,
        sessions,
        userMerchants,
        wallets,
        merchants,
        apiKeys,
        merchantRefStores,
        transactions,
        customers,
        customerMerChants,
        customerPoints,
        transactionTypes,
        vouchers,
        listingBatches,
        voucherCodes,
        treasuries,
        tempLinkCreateUsers,
        aisTransferLogs,
      }),
    };

    return {
      fileBuffer: Buffer.from(JSON.stringify(payload, null, 2), 'utf8'),
      fileName: `database-export-${exportedAt
        .toISOString()
        .replaceAll('.', '-')
        .replaceAll(':', '-')}.json`,
    };
  }

  private serializeValue(value: unknown): unknown {
    if (value instanceof Uint8Array || Buffer.isBuffer(value)) {
      return `0x${Buffer.from(value).toString('hex')}`;
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.serializeValue(item));
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([key, nestedValue]) => [
          key,
          this.serializeValue(nestedValue),
        ]),
      );
    }

    return value;
  }
}
