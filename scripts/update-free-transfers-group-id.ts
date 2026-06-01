import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

async function main() {
  const coupons = JSON.parse(fs.readFileSync('free-transferred-coupons.json', 'utf8'));
  const codesToUpdate = coupons.map((c: any) => c.code);
  
  if (codesToUpdate.length === 0) {
    console.log('No codes to update.');
    return;
  }
  
  console.log(`Found ${codesToUpdate.length} free transferred vouchers.`);
  console.log(`Updating voucherGroupId to null for these codes...`);
  
  const result = await prisma.voucherCode.updateMany({
    where: {
      code: { in: codesToUpdate }
    },
    data: {
      voucherGroupId: null
    }
  });
  
  console.log(`Successfully updated ${result.count} voucher codes!`);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
