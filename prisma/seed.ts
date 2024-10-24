import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const redeem = await prisma.transactionType.upsert({
    where: { id: 'redeem' },
    update: {},
    create: {
      id: 'redeem',
      name: 'Redeem',
      description: 'Redeem',
    },
  });
  const transfer = await prisma.transactionType.upsert({
    where: { id: 'transfer' },
    update: {},
    create: {
      id: 'transfer',
      name: 'Transfer',
      description: 'Transfer',
    },
  });
  console.log({ redeem, transfer });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
