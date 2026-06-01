import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- STARTING MARKETPLACE DB SYNC ---');

  const listingIds = ['22', '24', '31', '33']; // The Group IDs we manually delisted from Smart Contract
  
  // Clear the voucherGroupId so they leave the marketplace status in DB
  const result = await prisma.voucherCode.updateMany({
    where: { voucherGroupId: { in: listingIds } },
    data: { voucherGroupId: null }
  });

  console.log(`✅ Cleared voucherGroupId for ${result.count} remaining un-sold voucher codes in Database.`);
  
  await prisma.$disconnect();
  console.log('--- FINISHED ---');
}

main().catch(console.error);
