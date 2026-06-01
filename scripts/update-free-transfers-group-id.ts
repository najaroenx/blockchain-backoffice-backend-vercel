import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Querying free-transferred vouchers...');
  
  // Find all VOUCHER transfers from MERCHANT to CUSTOMER
  const voucherTx = await prisma.transaction.findMany({
    where: {
      type: 'VOUCHER',
      senderType: 'MERCHANT',
      receiverType: 'CUSTOMER',
    },
    include: {
      voucherCode: true
    }
  });

  const refIds = voucherTx.map(t => t.transactionRefId).filter(id => id !== null) as string[];

  const pointTx = await prisma.transaction.findMany({
    where: {
      transactionRefId: { in: refIds },
      type: 'POINT'
    },
    select: {
      transactionRefId: true
    }
  });

  const refIdsWithPoints = new Set(pointTx.map(t => t.transactionRefId));
  
  const codesToUpdate = new Set<string>();

  for (const tx of voucherTx) {
    if (tx.transactionRefId && refIdsWithPoints.has(tx.transactionRefId)) {
       continue;
    }
    
    if (tx.voucherCode && tx.voucherCode.code) {
        codesToUpdate.add(tx.voucherCode.code);
    }
  }

  const codesArray = Array.from(codesToUpdate);
  
  if (codesArray.length === 0) {
    console.log('No codes to update.');
    return;
  }
  
  console.log(`Found ${codesArray.length} free transferred vouchers.`);
  console.log(`Updating voucherGroupId to null for these codes...`);
  
  const result = await prisma.voucherCode.updateMany({
    where: {
      code: { in: codesArray }
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
