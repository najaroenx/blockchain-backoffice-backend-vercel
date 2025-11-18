import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface MigrationStats {
  total: number;
  updated: number;
  skipped: number;
  errors: number;
  errorDetails: Array<{ codeId: string; error: string }>;
}

/**
 * Migration script to populate pointId and currency for existing VoucherCodes
 * Strategy: For each code without pointId, get first point from voucher's merchant
 */
async function migrateVoucherCodesPointCurrency() {
  console.log(
    '[START] Migrating VoucherCodes to add pointId and currency...\n',
  );

  const stats: MigrationStats = {
    total: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    errorDetails: [],
  };

  try {
    // 1. Find all VoucherCodes without pointId
    console.log('[STEP 1] Finding VoucherCodes without pointId...');
    const codesWithoutPoint = await prisma.voucherCode.findMany({
      where: {
        pointId: null,
      },
      select: {
        id: true,
        code: true,
        voucherId: true,
        voucher: {
          select: {
            id: true,
            name: true,
            merchantId: true,
            merchant: {
              select: {
                id: true,
                name: true,
                point: {
                  take: 1, // Get first point
                  select: {
                    id: true,
                    symbol: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    stats.total = codesWithoutPoint.length;
    console.log(`[STEP 1] Found ${stats.total} VoucherCodes to migrate\n`);

    if (stats.total === 0) {
      console.log('[INFO] No VoucherCodes need migration. All done! ✅\n');
      return stats;
    }

    // 2. Process each code
    console.log('[STEP 2] Processing VoucherCodes...');
    for (const code of codesWithoutPoint) {
      try {
        const merchant = code.voucher.merchant;

        // Validate merchant exists
        if (!merchant) {
          stats.skipped++;
          console.log(
            `[SKIP] Code ${code.code}: Voucher has no merchant (voucherId: ${code.voucherId})`,
          );
          continue;
        }

        // Get first point from merchant
        const point = merchant.point[0];

        // Validate point exists
        if (!point) {
          stats.skipped++;
          console.log(
            `[SKIP] Code ${code.code}: Merchant "${merchant.name}" has no points`,
          );
          continue;
        }

        // Update VoucherCode with pointId and currency
        await prisma.voucherCode.update({
          where: { id: code.id },
          data: {
            pointId: point.id,
            currency: point.symbol,
          },
        });

        stats.updated++;
        console.log(
          `[UPDATE] Code ${code.code}: Set pointId="${point.id}", currency="${point.symbol}" (${point.name})`,
        );
      } catch (error) {
        stats.errors++;
        stats.errorDetails.push({
          codeId: code.id,
          error: error.message,
        });
        console.error(`[ERROR] Code ${code.code}: ${error.message}`);
      }
    }

    // 3. Summary
    console.log('\n[SUMMARY] Migration completed!');
    console.log('─'.repeat(50));
    console.log(`Total VoucherCodes:     ${stats.total}`);
    console.log(`✅ Updated:             ${stats.updated}`);
    console.log(`⏭️  Skipped:             ${stats.skipped}`);
    console.log(`❌ Errors:              ${stats.errors}`);
    console.log('─'.repeat(50));

    if (stats.errorDetails.length > 0) {
      console.log('\n[ERROR DETAILS]');
      stats.errorDetails.forEach((err) => {
        console.log(`  - Code ID: ${err.codeId}`);
        console.log(`    Error: ${err.error}`);
      });
    }

    return stats;
  } catch (error) {
    console.error('[FATAL ERROR] Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
migrateVoucherCodesPointCurrency()
  .then((stats) => {
    if (stats.errors > 0) {
      process.exit(1);
    }
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration script failed:', error);
    process.exit(1);
  });
