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
 * Migration script to populate thbPurchasePrice for Vouchers purchased by Marketer from Seller
 *
 * Strategy:
 * 1. Find Vouchers that have merchantId (assigned to Marketer)
 * 2. Find THB_BUY transactions for that merchant
 * 3. Calculate thbPurchasePrice from transaction amount / voucher codes count
 * 4. Or use ListingBatch price if available
 */
async function migrateThbPurchasePrice() {
  console.log('[START] Migrating Vouchers to add thbPurchasePrice...\n');

  const stats: MigrationStats = {
    total: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    errorDetails: [],
  };

  try {
    // 1. Find all Vouchers with merchantId but no thbPurchasePrice
    console.log(
      '[STEP 1] Finding Vouchers with merchantId but no thbPurchasePrice...',
    );
    const vouchersToMigrate = await prisma.voucher.findMany({
      where: {
        merchantId: { not: null },
        thbPurchasePrice: null,
      },
      select: {
        id: true,
        name: true,
        tokenId: true,
        merchantId: true,
        value: true,
        voucherCodes: {
          select: {
            id: true,
            listingBatchId: true,
            thbPrice: true,
          },
          take: 1,
        },
      },
    });

    stats.total = vouchersToMigrate.length;
    console.log(`[STEP 1] Found ${stats.total} vouchers to migrate\n`);

    if (stats.total === 0) {
      console.log('[DONE] No vouchers need migration');
      return stats;
    }

    // 2. Process each voucher
    console.log('[STEP 2] Processing vouchers...\n');

    for (const voucher of vouchersToMigrate) {
      try {
        let thbPurchasePrice: number | null = null;

        // Strategy 1: Check if VoucherCode has thbPrice (from new flow)
        if (voucher.voucherCodes[0]?.thbPrice) {
          thbPurchasePrice = voucher.voucherCodes[0].thbPrice;
          console.log(
            `  [${voucher.id}] Using thbPrice from VoucherCode: ${thbPurchasePrice} THB`,
          );
        }

        // Strategy 2: Check ListingBatch if available
        if (!thbPurchasePrice && voucher.voucherCodes[0]?.listingBatchId) {
          const batch = await prisma.listingBatch.findUnique({
            where: { id: voucher.voucherCodes[0].listingBatchId },
            select: {
              totalValue: true,
              totalItems: true,
            },
          });

          if (batch && batch.totalItems > 0) {
            thbPurchasePrice = batch.totalValue / batch.totalItems;
            console.log(
              `  [${voucher.id}] Using ListingBatch price: ${thbPurchasePrice} THB (totalValue: ${batch.totalValue}, totalItems: ${batch.totalItems})`,
            );
          }
        }

        // Strategy 3: Find THB_BUY transaction for this merchant with matching tokenId
        if (!thbPurchasePrice && voucher.merchantId) {
          const thbBuyTx = await prisma.transaction.findFirst({
            where: {
              senderId: voucher.merchantId,
              transactionTypeId: 'THB_BUY',
            },
            orderBy: {
              createdAt: 'desc',
            },
            select: {
              amount: true,
            },
          });

          if (thbBuyTx) {
            // Count voucher codes to calculate per-unit price
            const codeCount = await prisma.voucherCode.count({
              where: { voucherId: voucher.id },
            });

            if (codeCount > 0) {
              thbPurchasePrice = thbBuyTx.amount / codeCount;
              console.log(
                `  [${voucher.id}] Using THB_BUY transaction: ${thbPurchasePrice} THB (amount: ${thbBuyTx.amount}, codes: ${codeCount})`,
              );
            }
          }
        }

        // Strategy 4: Fallback to voucher.value (face value)
        if (!thbPurchasePrice && voucher.value) {
          thbPurchasePrice = voucher.value;
          console.log(
            `  [${voucher.id}] Fallback to voucher.value: ${thbPurchasePrice} THB`,
          );
        }

        // Update voucher if we found a price
        if (thbPurchasePrice !== null) {
          await prisma.voucher.update({
            where: { id: voucher.id },
            data: { thbPurchasePrice },
          });
          stats.updated++;
          console.log(
            `  ✅ [${voucher.id}] Updated thbPurchasePrice to ${thbPurchasePrice} THB`,
          );
        } else {
          stats.skipped++;
          console.log(
            `  ⏭️  [${voucher.id}] Skipped - no price source found`,
          );
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
migrateThbPurchasePrice()
  .then((stats) => {
    console.log('\n✅ Migration finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });
