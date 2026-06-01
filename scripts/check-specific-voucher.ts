import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const vid = 'COUPON-de6b3dce-8cd1-4f89-88a1-bb49281a3fe6';
  const voucher = await prisma.voucher.findUnique({
    where: { id: vid }
  });
  console.log('Voucher Details:', voucher);
  
  if (voucher) {
    const totalCodes = await prisma.voucherCode.count({
      where: { voucherId: vid }
    });
    const unusedMarketerCodes = await prisma.voucherCode.count({
      where: { 
        voucherId: vid, 
        isUsed: false, 
        currentOwnerType: 'MERCHANT' 
      }
    });
    console.log(`Total Codes: ${totalCodes}`);
    console.log(`Available Codes (Not Used & Owned by Merchant): ${unusedMarketerCodes}`);
  }
  await prisma.$disconnect();
}
main();
