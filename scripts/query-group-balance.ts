import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Voucher Group Balance Query ===");

  const groups = ["22", "31", "24", "33"];

  const rows = await prisma.voucherCode.groupBy({
    by: ["voucherGroupId", "currentOwnerType"],
    where: { voucherGroupId: { in: groups } },
    _count: { id: true },
  });

  for (const gId of groups) {
    const groupRows = rows.filter(r => r.voucherGroupId === gId);
    const merchant = groupRows.find(r => r.currentOwnerType === "MERCHANT")?._count.id ?? 0;
    const customer = groupRows.find(r => r.currentOwnerType === "CUSTOMER")?._count.id ?? 0;
    const total = groupRows.reduce((s, r) => s + r._count.id, 0);
    console.log(
      `Group ${gId} | total=${total} | MERCHANT(available)=${merchant} | CUSTOMER(sold)=${customer}`
    );
  }

  const t30 = rows.filter(r => ["22", "31"].includes(r.voucherGroupId ?? ""));
  const t32 = rows.filter(r => ["24", "33"].includes(r.voucherGroupId ?? ""));
  const t30Merchant = t30.filter(r => r.currentOwnerType === "MERCHANT").reduce((s, r) => s + r._count.id, 0);
  const t32Merchant = t32.filter(r => r.currentOwnerType === "MERCHANT").reduce((s, r) => s + r._count.id, 0);
  console.log(`
Token 30 total re-listable: ${t30Merchant} (should be 42)`);
  console.log(`Token 32 total re-listable: ${t32Merchant} (should be 32)`);

  await prisma.$disconnect();
}

main().catch(err => {
  console.error("[QueryGroupBalance] Error:", err);
  process.exit(0);
});
