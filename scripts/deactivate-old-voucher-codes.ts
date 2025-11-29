/**
 * Migration script to deactivate old voucher codes with UUID format voucherGroupId
 *
 * Background:
 * - Old system: voucherGroupId = "COUPON-{UUID}-{timestamp}" (UUID format)
 * - New system: voucherGroupId = numeric listingId from marketplace (e.g., "3")
 * - buyCoupon() requires numeric listingId, cannot accept UUID format
 *
 * This script:
 * 1. Finds all VoucherCode records where voucherGroupId is NOT numeric
 * 2. Sets voucherGroupId = null to mark them as not listed on marketplace
 * 3. Logs affected vouchers and merchants for notification
 *
 * Usage:
 *   npx ts-node scripts/deactivate-old-voucher-codes.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=================================================');
  console.log('Migration: Deactivate Old UUID Format Voucher Codes');
  console.log('=================================================\n');

  try {
    // 1. Find all voucher codes with voucherGroupId set
    console.log('[Step 1] Fetching voucher codes with voucherGroupId...');
    const allCodesWithGroupId = await prisma.voucherCode.findMany({
      where: {
        voucherGroupId: {
          not: null,
        },
      },
      include: {
        voucher: {
          include: {
            merchant: true,
          },
        },
      },
    });

    console.log(
      `Found ${allCodesWithGroupId.length} voucher codes with voucherGroupId\n`,
    );

    // 2. Filter codes with non-numeric voucherGroupId (UUID format)
    const oldFormatCodes = allCodesWithGroupId.filter((code) => {
      const groupId = code.voucherGroupId;
      // Check if voucherGroupId is NOT a numeric string
      return groupId && !/^\d+$/.test(groupId);
    });

    console.log(
      `[Step 2] Found ${oldFormatCodes.length} codes with old UUID format\n`,
    );

    if (oldFormatCodes.length === 0) {
      console.log('✅ No old format codes found. Migration not needed.');
      return;
    }

    // 3. Group by merchant and voucher for reporting
    const affectedMerchants = new Map<string, Set<string>>();

    oldFormatCodes.forEach((code) => {
      const merchantId = code.voucher?.merchantId || 'unknown';
      const voucherName = code.voucher?.name || 'Unknown Voucher';

      if (!affectedMerchants.has(merchantId)) {
        affectedMerchants.set(merchantId, new Set());
      }
      affectedMerchants
        .get(merchantId)!
        .add(`${voucherName} (${code.voucher?.id})`);
    });

    // 4. Display affected merchants and vouchers
    console.log('[Step 3] Affected merchants and vouchers:');
    console.log('─────────────────────────────────────────────────');
    affectedMerchants.forEach((vouchers, merchantId) => {
      const firstCode = oldFormatCodes.find(
        (c) => c.voucher?.merchantId === merchantId,
      );
      const merchantName = firstCode?.voucher?.merchant?.name || 'Unknown';

      console.log(`\nMerchant: ${merchantName} (ID: ${merchantId})`);
      console.log(`Vouchers to deactivate:`);
      vouchers.forEach((voucherName) => {
        console.log(`  - ${voucherName}`);
      });
    });
    console.log('\n─────────────────────────────────────────────────\n');

    // 5. Sample old format codes
    console.log('[Step 4] Sample old format voucherGroupId:');
    oldFormatCodes.slice(0, 5).forEach((code, idx) => {
      console.log(`  ${idx + 1}. ${code.voucherGroupId}`);
    });
    console.log('');

    // 6. Confirm migration
    console.log('[Step 5] Preparing to update database...');
    console.log(`Total codes to update: ${oldFormatCodes.length}`);
    console.log(`Action: Set voucherGroupId = NULL\n`);

    // 7. Perform migration
    const codeIds = oldFormatCodes.map((code) => code.id);

    const result = await prisma.voucherCode.updateMany({
      where: {
        id: {
          in: codeIds,
        },
      },
      data: {
        voucherGroupId: null,
      },
    });

    console.log('─────────────────────────────────────────────────');
    console.log('✅ Migration completed successfully!');
    console.log('─────────────────────────────────────────────────');
    console.log(`Updated ${result.count} voucher codes`);
    console.log('');
    console.log('Next steps:');
    console.log('1. Notify affected merchants to re-activate vouchers');
    console.log('2. Re-activation will create proper marketplace listings');
    console.log(
      '3. New voucher codes will have numeric listingId as voucherGroupId',
    );
    console.log('=================================================\n');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
