/**
 * Script to populate TransactionCategory for existing transactions
 * Based on transactionTypeId:
 *   - MINT, TRANSFER, BURN, EARN → POINT
 *   - REDEEM, MARKETPLACE_PURCHASE, MERCHANT_PURCHASE_FROM_SELLER, VOUCHER_TRANSFER, VOUCHER_GIFT → VOUCHER
 *
 * Usage:
 *   npx ts-node scripts/populate-transaction-category.ts
 */

import { PrismaClient, TransactionCategory } from '@prisma/client';

const prisma = new PrismaClient();

// Mapping transactionTypeId → category
const POINT_TYPES = ['MINT', 'TRANSFER', 'BURN', 'EARN'];
const VOUCHER_TYPES = [
  'REDEEM',
  'MARKETPLACE_PURCHASE',
  'MERCHANT_PURCHASE_FROM_SELLER',
  'VOUCHER_TRANSFER',
  'VOUCHER_GIFT',
];

async function main() {
  console.log(
    '🔄 Populating TransactionCategory for existing transactions...\n',
  );

  // Count transactions without category
  const totalWithoutCategory = await prisma.transaction.count({
    where: { category: null },
  });

  if (totalWithoutCategory === 0) {
    console.log('✅ All transactions already have category set!\n');
    return;
  }

  console.log(
    `📊 Found ${totalWithoutCategory} transactions without category\n`,
  );

  // Update POINT transactions
  console.log('🔵 Updating POINT transactions...');
  const pointResult = await prisma.transaction.updateMany({
    where: {
      category: null,
      transactionTypeId: { in: POINT_TYPES },
    },
    data: { category: TransactionCategory.POINT },
  });
  console.log(`   ✅ Updated ${pointResult.count} POINT transactions\n`);

  // Update VOUCHER transactions
  console.log('🟣 Updating VOUCHER transactions...');
  const voucherResult = await prisma.transaction.updateMany({
    where: {
      category: null,
      transactionTypeId: { in: VOUCHER_TYPES },
    },
    data: { category: TransactionCategory.VOUCHER },
  });
  console.log(`   ✅ Updated ${voucherResult.count} VOUCHER transactions\n`);

  // Check for transactions with pointId (fallback for POINT)
  console.log('🔵 Checking transactions with pointId (fallback)...');
  const pointIdResult = await prisma.transaction.updateMany({
    where: {
      category: null,
      pointId: { not: null },
    },
    data: { category: TransactionCategory.POINT },
  });
  console.log(`   ✅ Updated ${pointIdResult.count} transactions by pointId\n`);

  // Check for transactions with voucherCodeId (fallback for VOUCHER)
  console.log('🟣 Checking transactions with voucherCodeId (fallback)...');
  const voucherCodeResult = await prisma.transaction.updateMany({
    where: {
      category: null,
      voucherCodeId: { not: null },
    },
    data: { category: TransactionCategory.VOUCHER },
  });
  console.log(
    `   ✅ Updated ${voucherCodeResult.count} transactions by voucherCodeId\n`,
  );

  // Check remaining without category
  const remaining = await prisma.transaction.count({
    where: { category: null },
  });

  if (remaining > 0) {
    console.log(
      `⚠️  ${remaining} transactions still without category (unknown type)`,
    );

    // List them for debugging
    const unknownTxns = await prisma.transaction.findMany({
      where: { category: null },
      select: {
        id: true,
        transactionTypeId: true,
        pointId: true,
        voucherCodeId: true,
      },
      take: 10,
    });
    console.log('   Sample unknown transactions:');
    unknownTxns.forEach((tx) => {
      console.log(
        `   - ${tx.id}: typeId=${tx.transactionTypeId}, pointId=${tx.pointId}, voucherCodeId=${tx.voucherCodeId}`,
      );
    });
  } else {
    console.log('✅ All transactions now have category set!\n');
  }

  // Summary
  const summary = await prisma.transaction.groupBy({
    by: ['category'],
    _count: true,
  });
  console.log('\n📊 Summary:');
  summary.forEach((s) => {
    console.log(`   ${s.category || 'NULL'}: ${s._count} transactions`);
  });

  console.log('\n🎉 Done!');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
