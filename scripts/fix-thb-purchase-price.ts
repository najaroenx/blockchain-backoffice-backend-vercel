import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface MigrationStats {
  total: number;
  updated: number;
  skipped: number;
  errors: number;
  errorDetails: Array<{ voucherId: string; error: string }>;
}

/**
 * Migration script to fix thbPurchasePrice using actual THB_BUY transaction data
 * 
 * Strategy:
 * 1. Find THB_BUY transactions for each merchant
 * 2. Match with Voucher based on creation time and tokenId
 * 3. Calculate thbPurchasePrice = transaction.amount / codes purchased
 */
async function migrateThbPurchasePriceFromTransactions() {
  console.log('[START] Fixing thbPurchasePrice from actual THB_BUY transactions...\n');

  const stats: MigrationStats = {
    total: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    errorDetails: [],
  };

  try {
    // 1. Get all THB_BUY transactions
    console.log('[STEP 1] Finding THB_BUY transactions...');
    const thbBuyTransactions = await prisma.transaction.findMany({
      where: { transactionTypeId: 'THB_BUY' },
      select: {
        id: true,
        amount: true,
        senderId: true, // Merchant ID
        merchantId: true,
        createdAt: true,
        transactionRefId: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    console.log(`[STEP 1] Found ${thbBuyTransactions.length} THB_BUY transactions\n`);

    // 2. Find vouchers that need update (have merchantId but thbPurchasePrice might be wrong)
    console.log('[STEP 2] Finding vouchers with merchantId...');
    const vouchersToFix = await prisma.voucher.findMany({
      where: {
        merchantId: { not: null },
      },
      select: {
        id: true,
        name: true,
        tokenId: true,
        merchantId: true,
        merchantName: true,
        thbPurchasePrice: true,
        value: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { voucherCodes: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    stats.total = vouchersToFix.length;
    console.log(`[STEP 2] Found ${stats.total} vouchers to check\n`);

    // 3. For each voucher, find matching THB_BUY transaction
    console.log('[STEP 3] Matching vouchers with THB_BUY transactions...\n');

    for (const voucher of vouchersToFix) {
      try {
        const merchantId = voucher.merchantId!;
        
        // Find THB_BUY transactions from this merchant around the time voucher was updated
        // (updatedAt is when merchantId was set)
        const voucherUpdateTime = voucher.updatedAt;
        const timeWindowStart = new Date(voucherUpdateTime.getTime() - 300000); // 5 min before
        const timeWindowEnd = new Date(voucherUpdateTime.getTime() + 300000); // 5 min after

        const matchingTx = thbBuyTransactions.find(tx => {
          const txMerchantId = tx.senderId || tx.merchantId;
          const txTime = tx.createdAt;
          return (
            txMerchantId === merchantId &&
            txTime >= timeWindowStart &&
            txTime <= timeWindowEnd
          );
        });

        if (matchingTx) {
          // Calculate price per unit
          const codesCount = voucher._count.voucherCodes;
          if (codesCount > 0) {
            const pricePerUnit = matchingTx.amount / codesCount;
            
            console.log(`  [${voucher.id}] ${voucher.name}`);
            console.log(`    Merchant: ${voucher.merchantName}`);
            console.log(`    Transaction amount: ${matchingTx.amount} THB`);
            console.log(`    Codes count: ${codesCount}`);
            console.log(`    Price per unit: ${pricePerUnit} THB`);
            console.log(`    Previous thbPurchasePrice: ${voucher.thbPurchasePrice}`);

            // Update if different
            if (voucher.thbPurchasePrice !== pricePerUnit) {
              await prisma.voucher.update({
                where: { id: voucher.id },
                data: { thbPurchasePrice: pricePerUnit },
              });
              stats.updated++;
              console.log(`    ✅ Updated to ${pricePerUnit} THB\n`);
            } else {
              stats.skipped++;
              console.log(`    ⏭️  Already correct\n`);
            }
          } else {
            stats.skipped++;
            console.log(`  [${voucher.id}] Skipped - no voucher codes found`);
          }
        } else {
          // No matching transaction found - might be self-created voucher
          // Set to 0 if not from seller
          if (voucher.thbPurchasePrice !== null && voucher.thbPurchasePrice !== 0) {
            console.log(`  [${voucher.id}] ${voucher.name}`);
            console.log(`    No THB_BUY transaction found`);
            console.log(`    Previous thbPurchasePrice: ${voucher.thbPurchasePrice}`);
            console.log(`    This might be a self-created voucher, setting to 0`);
            
            await prisma.voucher.update({
              where: { id: voucher.id },
              data: { thbPurchasePrice: 0 },
            });
            stats.updated++;
            console.log(`    ✅ Set to 0 THB\n`);
          } else {
            stats.skipped++;
          }
        }
      } catch (error) {
        stats.errors++;
        stats.errorDetails.push({
          voucherId: voucher.id,
          error: error.message,
        });
        console.error(`  ❌ [${voucher.id}] Error: ${error.message}`);
      }
    }

    console.log('\n[DONE] Migration complete');
    console.log('=====================================');
    console.log(`Total vouchers: ${stats.total}`);
    console.log(`Updated: ${stats.updated}`);
    console.log(`Skipped: ${stats.skipped}`);
    console.log(`Errors: ${stats.errors}`);

    if (stats.errorDetails.length > 0) {
      console.log('\nError details:');
      stats.errorDetails.forEach((e) => {
        console.log(`  - ${e.voucherId}: ${e.error}`);
      });
    }

    return stats;
  } catch (error) {
    console.error('[FATAL ERROR]', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
migrateThbPurchasePriceFromTransactions()
  .then((stats) => {
    console.log('\n✅ Migration finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });
