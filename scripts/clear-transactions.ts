import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearTransactions() {
  console.log('🗑️  Starting transaction cleanup...\n');

  try {
    // Get counts before deletion
    const transactionCount = await prisma.transaction.count();
    console.log(`📊 Current transaction count: ${transactionCount}`);

    if (transactionCount === 0) {
      console.log('✅ No transactions to delete.');
      return;
    }

    // Confirm before deletion
    console.log('\n⚠️  This will delete ALL transactions from the database.');
    console.log('   Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');

    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Delete all transactions
    console.log('🔄 Deleting transactions...');
    const deleted = await prisma.transaction.deleteMany({});

    console.log(`\n✅ Successfully deleted ${deleted.count} transactions.`);

    // Verify deletion
    const remainingCount = await prisma.transaction.count();
    console.log(`📊 Remaining transaction count: ${remainingCount}`);
  } catch (error) {
    console.error('❌ Error clearing transactions:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Optional: Clear transactions for specific merchant
async function clearTransactionsByMerchant(merchantId: string) {
  console.log(`🗑️  Clearing transactions for merchant: ${merchantId}\n`);

  try {
    const count = await prisma.transaction.count({
      where: { merchantId },
    });

    console.log(`📊 Found ${count} transactions for merchant ${merchantId}`);

    if (count === 0) {
      console.log('✅ No transactions to delete.');
      return;
    }

    const deleted = await prisma.transaction.deleteMany({
      where: { merchantId },
    });

    console.log(`✅ Successfully deleted ${deleted.count} transactions.`);
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Optional: Clear transactions by date range
async function clearTransactionsByDateRange(startDate: Date, endDate: Date) {
  console.log(
    `🗑️  Clearing transactions from ${startDate.toISOString()} to ${endDate.toISOString()}\n`,
  );

  try {
    const count = await prisma.transaction.count({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    console.log(`📊 Found ${count} transactions in date range`);

    if (count === 0) {
      console.log('✅ No transactions to delete.');
      return;
    }

    const deleted = await prisma.transaction.deleteMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    console.log(`✅ Successfully deleted ${deleted.count} transactions.`);
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case '--merchant':
    if (!args[1]) {
      console.error('❌ Please provide merchant ID: --merchant <merchantId>');
      process.exit(1);
    }
    clearTransactionsByMerchant(args[1]);
    break;

  case '--date-range':
    if (!args[1] || !args[2]) {
      console.error(
        '❌ Please provide date range: --date-range <startDate> <endDate>',
      );
      console.error('   Example: --date-range 2026-01-01 2026-01-31');
      process.exit(1);
    }
    clearTransactionsByDateRange(new Date(args[1]), new Date(args[2]));
    break;

  case '--all':
  case undefined:
    clearTransactions();
    break;

  case '--help':
    console.log(`
Usage: npx ts-node scripts/clear-transactions.ts [options]

Options:
  --all                          Clear ALL transactions (default)
  --merchant <merchantId>        Clear transactions for specific merchant
  --date-range <start> <end>     Clear transactions in date range
  --help                         Show this help message

Examples:
  npx ts-node scripts/clear-transactions.ts --all
  npx ts-node scripts/clear-transactions.ts --merchant merch_123
  npx ts-node scripts/clear-transactions.ts --date-range 2026-01-01 2026-01-31
    `);
    break;

  default:
    console.error(`❌ Unknown command: ${command}`);
    console.log('   Use --help for usage information.');
    process.exit(1);
}
