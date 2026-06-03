import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const fixDataConfig = [
    { phone: '0852382761', wrongTokenId: 30 },
    { phone: '0971944518', wrongTokenId: 30 },
    { phone: '0933260703', wrongTokenId: 30 },
    { phone: '0899236096', wrongTokenId: 32 },
    { phone: '0863669959', wrongTokenId: 32 },
    { phone: '0895004537', wrongTokenId: 32 },
  ];
  
  const merchantId = 'cmmxc3v760003ze01xotjyeot'; // Marketer ID
  
  console.log(`\n=== 🛠️ STARTING PHASE 1: RECLAIM (DB ONLY) ===\n`);

  for (const item of fixDataConfig) {
      console.log(`\n▶ Processing Phone: ${item.phone}`);
      
      const customer = await prisma.customer.findUnique({
          where: { tel: item.phone }
      });

      if (!customer) {
          console.log(`❌ Skipped: Customer ไม่พบในระบบ`);
          continue;
      }

      // ตรวจสอบคูปองที่ผิดใน DB เท่านั้นเพื่อเอาความเป็นเจ้าของกลับมาที่ Merchant
      const wrongCodes = await prisma.voucherCode.findMany({
          where: {
              currentOwnerId: customer.id,
              currentOwnerType: 'CUSTOMER',
              voucher: { tokenId: item.wrongTokenId.toString() }
          }
      });

      if (wrongCodes.length > 0) {
          console.log(`- พบข้อมูล Token ${item.wrongTokenId} ที่ผิดพลาดจำนวน ${wrongCodes.length} รายการ`);
          
          for (const code of wrongCodes) {
             try {
                 await prisma.voucherCode.update({
                     where: { id: code.id },
                     data: {
                         currentOwnerId: merchantId,
                         currentOwnerType: 'MERCHANT'
                     }
                 });
                 console.log(`    ✅ DB updated: คืนความเป็นเจ้าของ ${code.code} สู่ Marketer แล้ว`);
                 
                 await prisma.transaction.deleteMany({
                     where: {
                         receiverId: customer.id,
                         type: 'VOUCHER',
                         voucherCodeId: code.id
                     }
                 });
                 console.log(`    ✅ DB updated: ลบประวัติการรับคูปองที่ผิดพลาดหน้าแอปอย่างสมบูรณ์`);
             } catch (err: any) {
                 console.log(`    ❌ ขัดข้องตอนอัปเดต Database: ${err.message}`);
             }
          }
      } else {
          console.log(`- ไม่พบคูปอง Token ${item.wrongTokenId} ใน Database ของลูกค้ารายนี้`);
      }
  }

  console.log(`\n=== 🎉 PHASE 1 DONE ===`);
  await prisma.$disconnect();
}

main();