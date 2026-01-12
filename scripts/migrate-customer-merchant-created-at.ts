import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface MigrationStats {
  total: number;
  updated: number;
  alreadyHasCreatedAt: number;
  errors: number;
  errorDetails: Array<{ recordId: string; error: string }>;
}

/**
 * Migration script to backfill createdAt for CustomerMerChant records
 * Strategy: Copy Customer.createdAt to CustomerMerChant.createdAt for records where it's null
 *
 * Prerequisites:
 * - The createdAt column must already exist in CustomerMerChant table
 * - Run this SQL first if column doesn't exist:
 *   ALTER TABLE "CustomerMerChant" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3);
 */
async function migrateCustomerMerchantCreatedAt() {
  console.log(
    '[START] Migrating CustomerMerChant to backfill createdAt...\n',
  );

  const stats: MigrationStats = {
    total: 0,
    updated: 0,
    alreadyHasCreatedAt: 0,
    errors: 0,
    errorDetails: [],
  };

  try {
    // 0. Check if createdAt column exists by doing a raw query
    console.log('[STEP 0] Checking if createdAt column exists...');
    try {
      const columnCheck = await prisma.$queryRaw<Array<{ exists: boolean }>>`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'CustomerMerChant' AND column_name = 'createdAt'
        ) as exists
      `;

      if (!columnCheck[0]?.exists) {
        console.log('[INFO] createdAt column does not exist. Creating it...');
        await prisma.$executeRaw`
          ALTER TABLE "CustomerMerChant" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3)
        `;
        console.log('[INFO] createdAt column created successfully ✅\n');
      } else {
        console.log('[INFO] createdAt column already exists ✅\n');
      }
    } catch (error) {
      console.log('[WARN] Could not check column existence, attempting to create...');
      await prisma.$executeRaw`
        ALTER TABLE "CustomerMerChant" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3)
      `;
      console.log('[INFO] createdAt column ensured ✅\n');
    }

    // 1. Find all CustomerMerChant records
    console.log('[STEP 1] Finding CustomerMerChant records...');
    const customerMerchants = await prisma.customerMerChant.findMany({
      select: {
        id: true,
        customerId: true,
        merchantId: true,
        createdAt: true,
        customer: {
          select: {
            id: true,
            createdAt: true,
          },
        },
      },
    });

    stats.total = customerMerchants.length;
    console.log(`[STEP 1] Found ${stats.total} CustomerMerChant records\n`);

    if (stats.total === 0) {
      console.log('[INFO] No CustomerMerChant records found. Done! ✅\n');
      return stats;
    }

    // 2. Process each record
    console.log('[STEP 2] Processing CustomerMerChant records...');
    for (const record of customerMerchants) {
      try {
        // Skip if already has createdAt
        if (record.createdAt) {
          stats.alreadyHasCreatedAt++;
          continue;
        }

        // Skip if no customer relation
        if (!record.customer) {
          stats.errors++;
          stats.errorDetails.push({
            recordId: record.id,
            error: 'No customer relation found',
          });
          console.log(
            `[SKIP] Record ${record.id}: No customer relation (customerId: ${record.customerId})`,
          );
          continue;
        }

        // Update CustomerMerChant with Customer's createdAt
        await prisma.customerMerChant.update({
          where: { id: record.id },
          data: {
            createdAt: record.customer.createdAt,
          },
        });

        stats.updated++;
        if (stats.updated % 100 === 0) {
          console.log(`[PROGRESS] Updated ${stats.updated} records...`);
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        stats.errors++;
        stats.errorDetails.push({
          recordId: record.id,
          error: errorMessage,
        });
        console.error(`[ERROR] Record ${record.id}: ${errorMessage}`);
      }
    }

    // 3. Summary
    console.log('\n[SUMMARY] Migration completed!');
    console.log('─'.repeat(50));
    console.log(`Total records:              ${stats.total}`);
    console.log(`✅ Updated:                 ${stats.updated}`);
    console.log(`⏭️  Already had createdAt:   ${stats.alreadyHasCreatedAt}`);
    console.log(`❌ Errors:                  ${stats.errors}`);
    console.log('─'.repeat(50));

    if (stats.errorDetails.length > 0) {
      console.log('\n[ERROR DETAILS]');
      stats.errorDetails.forEach((err) => {
        console.log(`  - Record ID: ${err.recordId}`);
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
migrateCustomerMerchantCreatedAt()
  .then((stats) => {
    if (stats.errors > 0) {
      process.exit(1);
    }
    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration script failed:', error);
    process.exit(1);
  });
