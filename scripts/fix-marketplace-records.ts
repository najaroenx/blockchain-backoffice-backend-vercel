import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- STARTING MARKETPLACE DB SYNC ---');

  const merchantId = 'cmmxc3v760003ze01xotjyeot'; // Beauty of Spectrum
  const targetTokenIds = ['30', '32']; 

  // ค้นหา voucherGroupId ทั้งหมดของ Token 30, 32 ที่ติดอยู่
  const codes = await prisma.voucherCode.findMany({
    where: {
      currentOwnerId: merchantId,
      currentOwnerType: 'MERCHANT',
      voucherGroupId: { not: null },
      voucher: {
        tokenId: { in: targetTokenIds }
      }
    },
    select: {
      voucherGroupId: true
    }
  });

  const listingIdsToClear = Array.from(new Set(codes.map(c => c.voucherGroupId).filter(id => id !== null))) as string[];

  console.log('Found listing IDs to clear based on DB records:', listingIdsToClear);

  if (listingIdsToClear.length > 0) {
    const result = await prisma.voucherCode.updateMany({
      where: { voucherGroupId: { in: listingIdsToClear } },
      data: { voucherGroupId: null }
    });

    console.log(`✅ Cleared voucherGroupId for ${result.count} remaining un-sold voucher codes in Database.`);
  } else {
    console.log('No voucher codes found that need clearing.');
  }
  
  await prisma.$disconnect();
  console.log('--- FINISHED ---');
}

main().catch(console.error);
