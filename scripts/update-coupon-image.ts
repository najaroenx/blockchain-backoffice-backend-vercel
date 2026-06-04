import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const couponId = "COUPON-56ede4a7-6fa9-43e0-9555-fef3d6ed323a";
  const newImageUrl = "https://cdn.discordapp.com/attachments/486388149665267733/1509146091331911680/BarneysBurgerJoint_350Voucher.png?ex=6a220092&is=6a20af12&hm=fabb09263e39bd47172ed0e6c15c6addba7fb10aa877a4f46a927e2e99dbcdab";

  const before = await prisma.voucher.findUnique({
    where: { id: couponId },
    select: { id: true, name: true, imageUrl: true },
  });
  console.log("Before:", JSON.stringify(before, null, 2));

  const updated = await prisma.voucher.update({
    where: { id: couponId },
    data: { imageUrl: newImageUrl },
    select: { id: true, name: true, imageUrl: true },
  });

  console.log("Updated:", JSON.stringify(updated, null, 2));
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
