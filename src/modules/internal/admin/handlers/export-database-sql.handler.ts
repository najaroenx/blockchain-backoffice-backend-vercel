import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';

type ColumnConfig = {
  property: string;
  column?: string;
  arrayType?: 'text';
};

type TableConfig = {
  tableName: string;
  prismaKey: string;
  columns: ColumnConfig[];
};

@Injectable()
export class ExportDatabaseSql {
  private readonly logger = new Logger(ExportDatabaseSql.name);

  private readonly tables: TableConfig[] = [
    {
      tableName: 'TransactionType',
      prismaKey: 'transactionType',
      columns: [
        { property: 'id' },
        { property: 'name' },
        { property: 'description' },
      ],
    },
    {
      tableName: 'Wallet',
      prismaKey: 'wallet',
      columns: [
        { property: 'id' },
        { property: 'walletAddress' },
        { property: 'seedPhrase' },
        { property: 'chainCode' },
        { property: 'derivationIndex' },
        { property: 'email' },
        { property: 'phoneNumber' },
        { property: 'type' },
        { property: 'status' },
      ],
    },
    {
      tableName: 'User',
      prismaKey: 'user',
      columns: [
        { property: 'id' },
        { property: 'email' },
        { property: 'password' },
        { property: 'walletId' },
        { property: 'nextDerivationIndex' },
        { property: 'createdAt', column: 'created_at' },
        { property: 'updatedAt', column: 'updated_at' },
      ],
    },
    {
      tableName: 'Merchant',
      prismaKey: 'merchant',
      columns: [
        { property: 'id' },
        { property: 'name' },
        { property: 'description' },
        { property: 'imageUrl' },
        { property: 'points' },
        { property: 'location' },
        { property: 'website' },
        { property: 'voucherIds', arrayType: 'text' },
        { property: 'createdAt', column: 'created_at' },
        { property: 'updatedAt', column: 'updated_at' },
        { property: 'tel' },
        { property: 'status' },
        { property: 'walletId' },
      ],
    },
    {
      tableName: 'Customer',
      prismaKey: 'customer',
      columns: [
        { property: 'id' },
        { property: 'email' },
        { property: 'firstName' },
        { property: 'lastName' },
        { property: 'tel' },
        { property: 'createdAt', column: 'created_at' },
        { property: 'updatedAt', column: 'updated_at' },
        { property: 'walletId' },
      ],
    },
    {
      tableName: 'Point',
      prismaKey: 'point',
      columns: [
        { property: 'id' },
        { property: 'name' },
        { property: 'symbol' },
        { property: 'contractAddress' },
        { property: 'initialSupply' },
        { property: 'decimal' },
        { property: 'startDate' },
        { property: 'endDate' },
        { property: 'epochDuration' },
        { property: 'imageUrl' },
        { property: 'createdAt', column: 'created_at' },
        { property: 'updatedAt', column: 'updated_at' },
        { property: 'merchantId' },
      ],
    },
    {
      tableName: 'MerchantRefStore',
      prismaKey: 'merchantRefStore',
      columns: [
        { property: 'id' },
        { property: 'merchantRef' },
        { property: 'name' },
        { property: 'category' },
        { property: 'description' },
        { property: 'imageUrl' },
        { property: 'locationUrl' },
        { property: 'website' },
        { property: 'isActive' },
        { property: 'createdAt', column: 'created_at' },
        { property: 'updatedAt', column: 'updated_at' },
      ],
    },
    {
      tableName: 'ApiKey',
      prismaKey: 'apiKey',
      columns: [
        { property: 'id' },
        { property: 'name' },
        { property: 'description' },
        { property: 'apiKey' },
        { property: 'merchantId' },
        { property: 'createdAt', column: 'created_at' },
        { property: 'updatedAt', column: 'updated_at' },
        { property: 'keyHash' },
        { property: 'keyPrefix' },
        { property: 'scopes', arrayType: 'text' },
        { property: 'expiresAt' },
        { property: 'lastUsedAt' },
        { property: 'isActive' },
      ],
    },
    {
      tableName: 'UserMerchant',
      prismaKey: 'userMerchant',
      columns: [
        { property: 'id' },
        { property: 'userId' },
        { property: 'merchantId' },
      ],
    },
    {
      tableName: 'CustomerMerChant',
      prismaKey: 'customerMerChant',
      columns: [
        { property: 'id' },
        { property: 'customerId' },
        { property: 'merchantId' },
        { property: 'createdAt' },
      ],
    },
    {
      tableName: 'Voucher',
      prismaKey: 'voucher',
      columns: [
        { property: 'id' },
        { property: 'name' },
        { property: 'description' },
        { property: 'status' },
        { property: 'merchantName' },
        { property: 'merchantId' },
        { property: 'merchantRef' },
        { property: 'sellerMerchantId' },
        { property: 'tokenId' },
        { property: 'valueType' },
        { property: 'value' },
        { property: 'thbPurchasePrice' },
        { property: 'currency' },
        { property: 'startDate' },
        { property: 'endDate' },
        { property: 'totalIssued' },
        { property: 'totalRedeemed' },
        { property: 'imageUrl' },
        { property: 'limitPerMember' },
        { property: 'createdAt', column: 'created_at' },
        { property: 'updatedAt', column: 'updated_at' },
      ],
    },
    {
      tableName: 'ListingBatch',
      prismaKey: 'listingBatch',
      columns: [
        { property: 'id' },
        { property: 'sellerWalletAddress' },
        { property: 'name' },
        { property: 'description' },
        { property: 'totalItems' },
        { property: 'soldItems' },
        { property: 'totalValue' },
        { property: 'currency' },
        { property: 'status' },
        { property: 'createdAt', column: 'created_at' },
        { property: 'updatedAt', column: 'updated_at' },
      ],
    },
    {
      tableName: 'VoucherCode',
      prismaKey: 'voucherCode',
      columns: [
        { property: 'id' },
        { property: 'code' },
        { property: 'voucherId' },
        { property: 'voucherGroupId' },
        { property: 'pointsCost' },
        { property: 'thbPrice' },
        { property: 'pointId' },
        { property: 'currency' },
        { property: 'isUsed' },
        { property: 'usedBy' },
        { property: 'usedAt' },
        { property: 'currentOwnerId' },
        { property: 'currentOwnerType' },
        { property: 'createdAt', column: 'created_at' },
        { property: 'listingBatchId' },
      ],
    },
    {
      tableName: 'Transaction',
      prismaKey: 'transaction',
      columns: [
        { property: 'id' },
        { property: 'txHash' },
        { property: 'senderAddress' },
        { property: 'receiverAddress' },
        { property: 'amount' },
        { property: 'eventId' },
        { property: 'createdAt', column: 'created_at' },
        { property: 'updatedAt', column: 'updated_at' },
        { property: 'merchantId' },
        { property: 'merchantRef' },
        { property: 'pointId' },
        { property: 'transactionTypeId' },
        { property: 'voucherCodeId' },
        { property: 'senderId' },
        { property: 'senderType' },
        { property: 'receiverId' },
        { property: 'receiverType' },
        { property: 'type' },
        { property: 'transactionRefId' },
      ],
    },
    {
      tableName: 'CustomerPoint',
      prismaKey: 'customerPoint',
      columns: [
        { property: 'id' },
        { property: 'customerId' },
        { property: 'pointId' },
        { property: 'balances' },
      ],
    },
    {
      tableName: 'Session',
      prismaKey: 'session',
      columns: [
        { property: 'id' },
        { property: 'token' },
        { property: 'createdAt', column: 'created_at' },
        { property: 'updatedAt', column: 'updated_at' },
        { property: 'userId' },
      ],
    },
    {
      tableName: 'Treasury',
      prismaKey: 'treasury',
      columns: [
        { property: 'id' },
        { property: 'walletAddress' },
        { property: 'type' },
        { property: 'createdAt', column: 'created_at' },
        { property: 'updatedAt', column: 'updated_at' },
      ],
    },
    {
      tableName: 'TempLinkCreateUser',
      prismaKey: 'tempLinkCreateUser',
      columns: [
        { property: 'id' },
        { property: 'uid' },
        { property: 'expire' },
        { property: 'phoneNumber' },
        { property: 'merchantId' },
        { property: 'otp' },
        { property: 'createdAt', column: 'created_at' },
        { property: 'updatedAt', column: 'updated_at' },
      ],
    },
    {
      tableName: 'AisTransferLog',
      prismaKey: 'aisTransferLog',
      columns: [
        { property: 'id' },
        { property: 'transactionID' },
        { property: 'action' },
        { property: 'url' },
        { property: 'requestBody' },
        { property: 'responseBody' },
        { property: 'httpStatus' },
        { property: 'success' },
        { property: 'errorMessage' },
        { property: 'msisdn' },
        { property: 'points' },
        { property: 'createdAt', column: 'created_at' },
      ],
    },
  ];

  constructor(private readonly prisma: PrismaService) {}

  async execute(): Promise<{ fileBuffer: Buffer; fileName: string }> {
    const exportedAt = new Date();

    this.logger.warn(
      '[Admin Export] Exporting full database contents as SQL including sensitive fields',
    );

    const tableRows = await Promise.all(
      this.tables.map(async (table) => ({
        table,
        rows: await (this.prisma as any)[table.prismaKey].findMany({
          orderBy: { id: 'asc' },
        }),
      })),
    );

    const sqlParts = [
      '-- Full database export generated by merchant-back-office-backend',
      `-- Exported at ${exportedAt.toISOString()}`,
      '-- WARNING: This file includes sensitive fields',
      'BEGIN;',
      '',
      this.buildTruncateStatement(),
      '',
      ...tableRows.flatMap(({ table, rows }) =>
        this.buildInsertStatements(table, rows),
      ),
      '',
      'COMMIT;',
      '',
    ];

    return {
      fileBuffer: Buffer.from(sqlParts.join('\n'), 'utf8'),
      fileName: `database-export-${exportedAt
        .toISOString()
        .replaceAll('.', '-')
        .replaceAll(':', '-')}.sql`,
    };
  }

  private buildTruncateStatement(): string {
    const tableNames = this.tables
      .map((table) => this.quoteIdentifier(table.tableName))
      .join(', ');

    return `TRUNCATE TABLE ${tableNames} RESTART IDENTITY CASCADE;`;
  }

  private buildInsertStatements(
    table: TableConfig,
    rows: Record<string, unknown>[],
  ): string[] {
    if (!rows.length) {
      return [`-- ${table.tableName}: no rows`];
    }

    const columnNames = table.columns
      .map((column) => this.quoteIdentifier(column.column ?? column.property))
      .join(', ');

    const values = rows
      .map((row) => {
        const serializedValues = table.columns
          .map((column) => this.serializeSqlValue(row[column.property], column))
          .join(', ');
        return `(${serializedValues})`;
      })
      .join(',\n');

    return [
      `-- ${table.tableName}: ${rows.length} row(s)`,
      `INSERT INTO ${this.quoteIdentifier(table.tableName)} (${columnNames}) VALUES`,
      `${values};`,
      '',
    ];
  }

  private serializeSqlValue(value: unknown, column: ColumnConfig): string {
    if (value === null || value === undefined) {
      return 'NULL';
    }

    if (Array.isArray(value)) {
      if (!value.length) {
        return `ARRAY[]::${column.arrayType ?? 'text'}[]`;
      }

      const items = value
        .map((item) =>
          this.serializeSqlValue(item, { property: column.property }),
        )
        .join(', ');
      return `ARRAY[${items}]`;
    }

    if (value instanceof Date) {
      return this.escapeString(value.toISOString());
    }

    if (value instanceof Uint8Array || Buffer.isBuffer(value)) {
      return this.escapeString(
        String.raw`\x${Buffer.from(value).toString('hex')}`,
      );
    }

    if (typeof value === 'string') {
      return this.escapeString(value);
    }

    if (typeof value === 'number') {
      return Number.isFinite(value) ? String(value) : 'NULL';
    }

    if (typeof value === 'boolean') {
      return value ? 'TRUE' : 'FALSE';
    }

    return this.escapeString(JSON.stringify(value));
  }

  private escapeString(value: string): string {
    return `'${value.replaceAll("'", "''")}'`;
  }

  private quoteIdentifier(value: string): string {
    return `"${value.replaceAll('"', '""')}"`;
  }
}
