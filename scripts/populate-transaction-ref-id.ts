/**
 * Script to populate transactionRefId for existing transactions
 *
 * Each existing transaction gets a unique UUID as transactionRefId
 * This ensures all transactions have a reference ID for consistency
 *
 * Usage:
 *   npx ts-node scripts/populate-transaction-ref-id.ts
 *
 * Or compile and run:
 *   npx tsc scripts/populate-transaction-ref-id.ts --outDir dist/scripts --esModuleInterop --resolveJsonModule
 *   node dist/scripts/populate-transaction-ref-id.js
 */

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting transactionRefId population...');

  // Find all transactions without transactionRefId
  const transactionsWithoutRefId = await prisma.transaction.findMany({
    where: {
      transactionRefId: null,
    },
    select: {
      id: true,
    },
  });

  console.log(
    `Found ${transactionsWithoutRefId.length} transactions without transactionRefId`,
  );

  if (transactionsWithoutRefId.length === 0) {
    console.log('No transactions to update. Exiting.');
    return;
  }

  // Update each transaction with a unique UUID
  let updatedCount = 0;
  const batchSize = 100;

  for (let i = 0; i < transactionsWithoutRefId.length; i += batchSize) {
    const batch = transactionsWithoutRefId.slice(i, i + batchSize);

    await prisma.$transaction(
      batch.map((tx) =>
        prisma.transaction.update({
          where: { id: tx.id },
          data: { transactionRefId: randomUUID() },
        }),
      ),
    );

    updatedCount += batch.length;
    console.log(
      `Progress: ${updatedCount}/${transactionsWithoutRefId.length} transactions updated`,
    );
  }

  console.log(`\n✅ Successfully populated transactionRefId for ${updatedCount} transactions`);
}

main()
  .catch((e) => {
    console.error('Error populating transactionRefId:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
