/**
 * Script to populate AssetType (type field) for existing transactions
 * Based on transactionTypeId:
 *   - MINT, TRANSFER, BURN, EARN → POINT
 *   - REDEEM, MARKETPLACE_PURCHASE, MERCHANT_PURCHASE_FROM_SELLER, VOUCHER_TRANSFER, VOUCHER_GIFT → VOUCHER
 *
 * Usage:
 *   npx ts-node scripts/populate-transaction-type.ts
 */

import { PrismaClient, AssetType } from '@prisma/client';

const prisma = new PrismaClient();

// Mapping transactionTypeId → type
const POINT_TYPES = ['MINT', 'TRANSFER', 'BURN', 'EARN'];
const VOUCHER_TYPES = [
  'REDEEM',
  'MARKETPLACE_PURCHASE',
  'MERCHANT_PURCHASE_FROM_SELLER',
  'VOUCHER_TRANSFER',
  'VOUCHER_GIFT',
];

async function main() {
  console.log('🔄 Populating AssetType (type) for existing transactions...\n');

  // Count transactions without type
  const totalWithoutType = await prisma.transaction.count({
    where: { type: null },
  });

  if (totalWithoutType === 0) {
    console.log('✅ All transactions already have type set!\n');
    return;
  }

  console.log(`📊 Found ${totalWithoutType} transactions without type\n`);

  // Update POINT transactions
  console.log('🔵 Updating POINT transactions...');
  const pointResult = await prisma.transaction.updateMany({
    where: {
      type: null,
      transactionTypeId: { in: POINT_TYPES },
    },
    data: { type: AssetType.POINT },
  });
  console.log(`   ✅ Updated ${pointResult.count} POINT transactions\n`);

  // Update VOUCHER transactions
  console.log('🟣 Updating VOUCHER transactions...');
  const voucherResult = await prisma.transaction.updateMany({
    where: {
      type: null,
      transactionTypeId: { in: VOUCHER_TYPES },
    },
    data: { type: AssetType.VOUCHER },
  });
  console.log(`   ✅ Updated ${voucherResult.count} VOUCHER transactions\n`);

  // Check for transactions with pointId (fallback for POINT)
  console.log('🔵 Checking transactions with pointId (fallback)...');
  const pointIdResult = await prisma.transaction.updateMany({
    where: {
      type: null,
      pointId: { not: null },
    },
    data: { type: AssetType.POINT },
  });
  console.log(`   ✅ Updated ${pointIdResult.count} transactions by pointId\n`);

  // Check for transactions with voucherCodeId (fallback for VOUCHER)
  console.log('🟣 Checking transactions with voucherCodeId (fallback)...');
  const voucherCodeResult = await prisma.transaction.updateMany({
    where: {
      type: null,
      voucherCodeId: { not: null },
    },
    data: { type: AssetType.VOUCHER },
  });
  console.log(
    `   ✅ Updated ${voucherCodeResult.count} transactions by voucherCodeId\n`,
  );

  // Check remaining without type
  const remaining = await prisma.transaction.count({
    where: { type: null },
  });

  if (remaining > 0) {
    console.log(
      `⚠️  ${remaining} transactions still without type (unknown type)`,
    );

    // List them for debugging
    const unknownTxns = await prisma.transaction.findMany({
      where: { type: null },
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
    console.log('✅ All transactions now have type set!\n');
  }

  // Summary
  const summary = await prisma.transaction.groupBy({
    by: ['type'],
    _count: true,
  });
  console.log('\n📊 Summary:');
  summary.forEach((s) => {
    console.log(`   ${s.type || 'NULL'}: ${s._count} transactions`);
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
