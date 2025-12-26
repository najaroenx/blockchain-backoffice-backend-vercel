import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SELLER_WALLET_ADDRESS = '0xf5e40ec8bfa4818278c04489b34a486281658e5c';

async function main() {
  console.log('=================================================');
  console.log('Migration: Seller Listings to ListingBatch');
  console.log('=================================================\n');
  console.log(`Seller Wallet: ${SELLER_WALLET_ADDRESS}\n`);

  // 1. Find VoucherCodes without ListingBatch (seller listings = THB currency, no pointId)
  const orphanedCodes = await prisma.voucherCode.findMany({
    where: {
      currency: 'THB',
      pointId: null,
      voucherGroupId: { not: null },
      listingBatchId: null,
    },
    include: {
      voucher: { select: { id: true, name: true } },
    },
  });

  console.log(`Found ${orphanedCodes.length} VoucherCodes without ListingBatch\n`);

  if (orphanedCodes.length === 0) {
    console.log('✅ No migration needed.');
    await prisma.$disconnect();
    return;
  }

  // 2. Group by voucherGroupId (listingId from blockchain)
  const groups = new Map<string, typeof orphanedCodes>();
  orphanedCodes.forEach((code) => {
    const key = code.voucherGroupId!;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(code);
  });

  console.log(`Grouped into ${groups.size} listings\n`);

  // 3. Create ListingBatch for each group
  let created = 0;

  for (const [listingId, codes] of groups) {
    const totalItems = codes.length;
    const soldCount = codes.filter((c) => c.currentOwnerId !== null).length;
    const totalValue = codes.reduce((sum, c) => sum + c.pointsCost, 0);
    const status = soldCount >= totalItems ? 'SOLD_OUT' : 'ACTIVE';
    const voucherName = codes[0]?.voucher?.name || 'Unknown';

    const batch = await prisma.listingBatch.create({
      data: {
        sellerWalletAddress: SELLER_WALLET_ADDRESS.toLowerCase(),
        name: `Migrated: ${voucherName}`,
        description: `Listing ID: ${listingId}`,
        totalItems,
        soldItems: soldCount,
        totalValue,
        currency: 'THB',
        status,
      },
    });

    await prisma.voucherCode.updateMany({
      where: { id: { in: codes.map((c) => c.id) } },
      data: { listingBatchId: batch.id },
    });

    console.log(
      `[${listingId}] → batch ${batch.id} (${status}, ${soldCount}/${totalItems} sold, ${voucherName})`,
    );
    created++;
  }

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`✅ Done! Created ${created} ListingBatch records`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('❌ Error:', e);
  process.exit(1);
});
