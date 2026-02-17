import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Migration script: Fix REDEEM transactions that have receiverId = NULL
 *
 * Problem:
 *   REDEEM transactions were created with receiverId: null but receiverType: MERCHANT
 *   This causes receiverId to return null in API responses
 *
 * Fix:
 *   Set receiverId = merchantId for all affected REDEEM VOUCHER transactions
 *
 * Usage:
 *   npx ts-node scripts/fix-redeem-receiver-id.ts
 */
async function fixRedeemReceiverId() {
  console.log('[START] Fixing REDEEM transactions with null receiverId...\n');

  // 1. Find affected transactions
  const affectedTransactions = await prisma.transaction.findMany({
    where: {
      transactionTypeId: 'REDEEM',
      type: 'VOUCHER',
      receiverId: null,
      receiverType: 'MERCHANT',
      merchantId: { not: null },
    },
    select: {
      id: true,
      merchantId: true,
      senderId: true,
      receiverId: true,
      receiverType: true,
      createdAt: true,
    },
  });

  console.log(`Found ${affectedTransactions.length} transactions to fix\n`);

  if (affectedTransactions.length === 0) {
    console.log('[DONE] No transactions need fixing.');
    await prisma.$disconnect();
    return;
  }

  // 2. Preview first 5 records
  console.log('Preview (first 5):');
  affectedTransactions.slice(0, 5).forEach((tx) => {
    console.log(
      `  ID: ${tx.id} | merchantId: ${tx.merchantId} | senderId: ${tx.senderId} | receiverId: ${tx.receiverId} | createdAt: ${tx.createdAt}`,
    );
  });
  console.log('');

  // 3. Update all affected transactions
  let updated = 0;
  let errors = 0;

  for (const tx of affectedTransactions) {
    try {
      await prisma.transaction.update({
        where: { id: tx.id },
        data: { receiverId: tx.merchantId },
      });
      updated++;
    } catch (error) {
      errors++;
      console.error(`  [ERROR] Failed to update ${tx.id}: ${error.message}`);
    }
  }

  // 4. Summary
  console.log('\n========== SUMMARY ==========');
  console.log(`Total affected:  ${affectedTransactions.length}`);
  console.log(`Updated:         ${updated}`);
  console.log(`Errors:          ${errors}`);
  console.log('=============================\n');

  // 5. Verify
  const remaining = await prisma.transaction.count({
    where: {
      transactionTypeId: 'REDEEM',
      type: 'VOUCHER',
      receiverId: null,
      receiverType: 'MERCHANT',
      merchantId: { not: null },
    },
  });
  console.log(`Remaining unfixed: ${remaining}`);
  console.log('[DONE]');

  await prisma.$disconnect();
}

fixRedeemReceiverId().catch((error) => {
  console.error('[FATAL]', error);
  prisma.$disconnect();
  process.exit(1);
});
