import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaClient } from '@prisma/client';
import { TransferVoucherToCustomerHandler } from '../src/modules/internal/voucher/handlers/transferVoucherToCustomer.handler';

const prisma = new PrismaClient();

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  // ใช้ยิง API โอนเหมือนตอนหน้าบ้านแจกเป๊ะ ๆ 
  const transferHandler = app.get(TransferVoucherToCustomerHandler);

  const fixDataConfig = [
    { phone: '0852382761', correctVoucherId: 'COUPON-e3b83738-7a28-4dac-90a1-c2fab7343881' },
    { phone: '0971944518', correctVoucherId: 'COUPON-e3b83738-7a28-4dac-90a1-c2fab7343881' },
    { phone: '0933260703', correctVoucherId: 'COUPON-e3b83738-7a28-4dac-90a1-c2fab7343881' },
    { phone: '0899236096', correctVoucherId: 'COUPON-92a9efc1-48be-4d44-9c9f-ab5245243fcc' },
    { phone: '0863669959', correctVoucherId: 'COUPON-d811c94c-9644-42d1-beae-8cc8da16d974' },
    { phone: '0895004537', correctVoucherId: 'COUPON-d811c94c-9644-42d1-beae-8cc8da16d974' },
  ];
  
  const merchantId = 'cmmxc3v760003ze01xotjyeot'; // Marketer ID
  
  console.log(`\n=== 🛠️ STARTING PHASE 2: DISTRIBUTE CORRECT VOUCHERS ===\n`);

  for (const item of fixDataConfig) {
      console.log(`\n▶ Processing Phone: ${item.phone}`);
      
      const customer = await prisma.customer.findUnique({
          where: { tel: item.phone }
      });

      if (!customer) {
          console.log(`❌ Skipped: Customer ไม่พบในระบบ`);
          continue;
      }

      console.log(`- กำลังทำการแจก Voucher ถูกต้องแทนที่ (Voucher ID: ${item.correctVoucherId})`);
      const hasCorrectCode = await prisma.voucherCode.findFirst({
         where: { currentOwnerId: customer.id, voucherId: item.correctVoucherId }
      });
      
      if (!hasCorrectCode) {
          try {
              const res = await transferHandler.execute({
                merchantId: merchantId,
                customerPhone: item.phone,
                voucherId: item.correctVoucherId
              });
              console.log(`  ✅ แจกคูปองสำเร็จ! Code ID ที่ลูกค้าได้รับใหม่คือ: ${res?.voucherCodeIds?.[0] || 'N/A'}`);
          } catch (err: any) {
              console.log(`  ❌ ล้มเหลวในการโอนคูปองชดเชย: ${err.message}`);
          }
      } else {
          console.log(`  > ข้าม: พบว่าลูกค้ารายนี้มีคูปองที่ถูกต้องอยู่แล้ว (ID: ${hasCorrectCode.id})`);
      }
  }

  console.log(`\n=== 🎉 PHASE 2 DONE ===`);
  await app.close();
  await prisma.$disconnect();
}

main();