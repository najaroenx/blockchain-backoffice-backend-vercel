import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Migration script: Fix THB_BUY transactions receiver to be SELLER
 *
 * Problem:
 *   THB_BUY transactions (merchant buying coupons from seller) were created with:
 *   - receiverId: null
 *   - receiverType: SYSTEM
 *   But the actual receiver is the seller merchant.
 *
 * Fix:
 *   1. Resolve sellerMerchantId from VoucherCode → Voucher.sellerMerchantId
 *   2. Set receiverId = sellerMerchantId
 *   3. Set receiverType = SELLER
 *
 * Usage:
 *   npx ts-node scripts/fix-thb-buy-receiver-seller.ts
 */
async function fixThbBuyReceiverSeller() {
  console.log(
    '[START] Fixing THB_BUY transactions with null receiverId...\n',
  );

  // 1. Find affected THB_BUY transactions
  const affectedTransactions = await prisma.transaction.findMany({
    where: {
      transactionTypeId: 'THB_BUY',
      type: 'THB_TOKEN',
      receiverId: null,
      receiverType: 'SYSTEM',
      voucherCodeId: { not: null },
    },
    select: {
      id: true,
      merchantId: true,
      senderId: true,
      receiverId: true,
      receiverType: true,
      voucherCodeId: true,
      transactionRefId: true,
      createdAt: true,
    },
  });

  console.log(`Found ${affectedTransactions.length} transactions to fix\n`);

  if (affectedTransactions.length === 0) {
    console.log('[DONE] No transactions need fixing.');
    await prisma.$disconnect();
    return;
  }

  // 2. Resolve sellerMerchantId for each transaction via VoucherCode → Voucher
  //    Cache by voucherCodeId to avoid duplicate queries
  const sellerCache = new Map<string, string | null>();

  for (const tx of affectedTransactions) {
    if (!tx.voucherCodeId || sellerCache.has(tx.voucherCodeId)) continue;

    const voucherCode = await prisma.voucherCode.findUnique({
      where: { id: tx.voucherCodeId },
      select: {
        voucher: {
          select: {
            sellerMerchantId: true,
          },
        },
      },
    });

    sellerCache.set(
      tx.voucherCodeId,
      voucherCode?.voucher?.sellerMerchantId || null,
    );
  }

  // 3. Preview first 5 records
  console.log('Preview (first 5):');
  affectedTransactions.slice(0, 5).forEach((tx) => {
    const sellerId = sellerCache.get(tx.voucherCodeId!) || 'N/A';
    console.log(
      `  ID: ${tx.id} | senderId: ${tx.senderId} | receiverId: ${tx.receiverId} → ${sellerId} | receiverType: ${tx.receiverType} → SELLER | refId: ${tx.transactionRefId} | createdAt: ${tx.createdAt}`,
    );
  });
  console.log('');

  // 4. Update all affected transactions
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const tx of affectedTransactions) {
    const sellerMerchantId = sellerCache.get(tx.voucherCodeId!) || null;

    if (!sellerMerchantId) {
      skipped++;
      console.log(
        `  [SKIP] ${tx.id} - No sellerMerchantId found for voucherCodeId: ${tx.voucherCodeId}`,
      );
      continue;
    }

    try {
      await prisma.transaction.update({
        where: { id: tx.id },
        data: {
          receiverId: sellerMerchantId,
          receiverType: 'SELLER',
        },
      });
      updated++;
    } catch (error: any) {
      errors++;
      console.error(`  [ERROR] Failed to update ${tx.id}: ${error.message}`);
    }
  }

  // 5. Summary
  console.log('\n========== SUMMARY ==========');
  console.log(`Total affected:  ${affectedTransactions.length}`);
  console.log(`Updated:         ${updated}`);
  console.log(`Skipped (no seller): ${skipped}`);
  console.log(`Errors:          ${errors}`);
  console.log('=============================\n');

  // 6. Verify
  const remaining = await prisma.transaction.count({
    where: {
      transactionTypeId: 'THB_BUY',
      type: 'THB_TOKEN',
      receiverId: null,
      receiverType: 'SYSTEM',
      voucherCodeId: { not: null },
    },
  });
  console.log(`Remaining unfixed: ${remaining}`);
  console.log('[DONE]');

  await prisma.$disconnect();
}

fixThbBuyReceiverSeller().catch((error) => {
  console.error('[FATAL]', error);
  prisma.$disconnect();
  process.exit(1);
});
