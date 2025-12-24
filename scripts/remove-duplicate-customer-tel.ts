/**
 * Script to remove duplicate customer tel values, keeping only the latest record
 * AND resolve failed migration state
 *
 * Usage:
 *   npx ts-node scripts/remove-duplicate-customer-tel.ts
 *
 * With specific DATABASE_URL:
 *   DATABASE_URL="your_database_url" npx ts-node scripts/remove-duplicate-customer-tel.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const MIGRATION_NAME = '20251217041144_make_customer_tel_unique';

async function resolveFailedMigration() {
  console.log('🔧 Checking for failed migrations...\n');

  try {
    // Check if migration is in failed state (started but not finished)
    const failedMigrations = await prisma.$queryRaw<
      { migration_name: string; finished_at: Date | null }[]
    >`
      SELECT migration_name, finished_at 
      FROM "_prisma_migrations" 
      WHERE migration_name = ${MIGRATION_NAME}
      AND finished_at IS NULL
    `;

    if (failedMigrations.length > 0) {
      console.log(`⚠️  Found failed migration: ${MIGRATION_NAME}`);
      console.log('🔄 Removing failed migration record...\n');

      // Delete the failed migration record so it can be re-applied
      await prisma.$executeRaw`
        DELETE FROM "_prisma_migrations" 
        WHERE migration_name = ${MIGRATION_NAME}
      `;

      console.log(
        '✅ Removed failed migration record. It will be re-applied.\n',
      );
    } else {
      console.log('✅ No failed migrations found.\n');
    }
  } catch (error) {
    console.log(`⚠️  Error checking migrations: ${error.message}\n`);
  }
}

async function removeDuplicates() {
  console.log('🔍 Finding duplicate customer tel values...\n');

  // Find all duplicate tel values
  const duplicates = await prisma.$queryRaw<{ tel: string; count: bigint }[]>`
    SELECT tel, COUNT(*) as count 
    FROM "Customer" 
    WHERE tel IS NOT NULL 
    GROUP BY tel 
    HAVING COUNT(*) > 1
  `;

  if (duplicates.length === 0) {
    console.log('✅ No duplicate tel values found!\n');
    return;
  }

  console.log(`⚠️  Found ${duplicates.length} duplicate tel values:\n`);

  let totalDeleted = 0;

  for (const dup of duplicates) {
    console.log(`📱 Tel: ${dup.tel} (${dup.count} records)`);

    // Get all customers with this tel, ordered by createdAt DESC (latest first)
    const customers = await prisma.customer.findMany({
      where: { tel: dup.tel },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        tel: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Keep the first one (latest), delete the rest
    const [keep, ...toDelete] = customers;

    console.log(`   ✅ Keeping: ${keep.id} (created: ${keep.createdAt})`);

    for (const customer of toDelete) {
      console.log(
        `   ❌ Deleting: ${customer.id} (created: ${customer.createdAt})`,
      );

      try {
        // Delete related records first (in order of dependencies)

        // 1. Delete transactions where this customer is sender or receiver
        await prisma.transaction.deleteMany({
          where: {
            OR: [{ senderId: customer.id }, { receiverId: customer.id }],
          },
        });

        // 2. Delete CustomerPoint records
        await prisma.customerPoint.deleteMany({
          where: { customerId: customer.id },
        });

        // 3. Delete CustomerMerChant records
        await prisma.customerMerChant.deleteMany({
          where: { customerId: customer.id },
        });

        // 4. Update VoucherCode to remove ownership
        await prisma.voucherCode.updateMany({
          where: { currentOwnerId: customer.id },
          data: { currentOwnerId: null },
        });

        // 5. Get wallet ID before deleting customer
        const wallet = await prisma.wallet.findFirst({
          where: { customer: { id: customer.id } },
        });

        // 7. Delete the customer (this should cascade some relations)
        await prisma.customer.delete({
          where: { id: customer.id },
        });

        // 8. Delete wallet if exists
        if (wallet) {
          await prisma.wallet.delete({
            where: { id: wallet.id },
          });
        }

        totalDeleted++;
      } catch (error) {
        console.log(`   ⚠️  Error deleting ${customer.id}: ${error.message}`);
      }
    }

    console.log('');
  }

  console.log(`\n🎉 Done! Deleted ${totalDeleted} duplicate records.\n`);
}

async function main() {
  // Step 1: Remove duplicates first
  await removeDuplicates();

  // Step 2: Resolve failed migration
  await resolveFailedMigration();

  console.log('📌 Now prisma migrate deploy should work!');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
