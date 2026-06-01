import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // --- ตั้งค่าตัวแปรตรงนี้อิงจาก Response ที่ให้มา ---
  const targetCodeId = 'cmnd3gs52009c2s01pof5vn0d';
  const targetTransactionId = 'cmpqodh6n000pwi019d49c0fv';
  // ---------------------------------------------

  // 1. หาข้อมูล Transaction เพื่อให้รู้ว่าใครเป็นคนโอน (Sender)
  const tx = await prisma.transaction.findUnique({
    where: { id: targetTransactionId },
  });

  if (!tx) {
    console.log(`❌ ไม่พบข้อมูล Transaction ID: ${targetTransactionId}`);
    return;
  }

  // 2. อัปเดต VoucherCode ให้หายไปจากระบบ (ตั้งให้ระบบเป็นเจ้าของแทน)
  const code = await prisma.voucherCode.findUnique({ where: { id: targetCodeId } });
  if (!code) {
    console.log(`❌ ไม่พบคูปอง ID: ${targetCodeId}`);
    return;
  }

  // เปลี่ยนเป็น SYSTEM เพื่อให้ไม่ไปโผล่ที่ Customer และ ไม่โผล่กลับไปที่ Marketer
  await prisma.voucherCode.update({
    where: { id: targetCodeId },
    data: {
      currentOwnerId: 'SYSTEM_VOID',
      currentOwnerType: 'SYSTEM'
    }
  });
  console.log(`🔄 โอนโค้ด ${code.code} กลับคืนให้ระบบ (SYSTEM) เรียบร้อยแล้ว (ทั้ง Marketer และ User จะมองไม่เห็น)`);

  // 3. ลบ Transaction (Transfer) เพื่อล้างประวัติเสมือนไม่เคยโอน
  await prisma.transaction.delete({ where: { id: targetTransactionId } });
  console.log(`🗑️  ลบประวัติการโอนออกจาก DB เรียบร้อย`);

  console.log('🎉 เสร็จสิ้น! คูปองถูกริบคืนเป็นของระบบ ซ่อนจากทุกหน้าจอเรียบร้อยแล้ว');
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
