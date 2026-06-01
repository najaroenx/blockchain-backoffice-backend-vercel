import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { BlockchainService } from '../src/providers/blockchain/blockchain.service';
import { TokenService } from '../src/providers/token/token.service';
import { ConfigService } from '@nestjs/config';
import { getSignerFromSeedPhrase } from '../src/libs/derive-wallet';
import { PrismaClient } from '@prisma/client';
import { TransferVoucherToCustomerHandler } from '../src/modules/internal/voucher/handlers/transferVoucherToCustomer.handler';

const prisma = new PrismaClient();

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const blockchainService = app.get(BlockchainService);
  const tokenService = app.get(TokenService); 
  const configService = app.get(ConfigService);
  const transferHandler = app.get(TransferVoucherToCustomerHandler);

  // 📋 ข้อมูลที่ต้องการแก้ไข (เบอร์ -> Token ที่ต้องดึงคืน -> Voucher ใหม่ที่ต้องแจก)
  const fixDataConfig = [
    { phone: '0852382761', wrongTokenId: 30, correctVoucherId: 'COUPON-e3b83738-7a28-4dac-90a1-c2fab7343881' },
    { phone: '0971944518', wrongTokenId: 30, correctVoucherId: 'COUPON-e3b83738-7a28-4dac-90a1-c2fab7343881' },
    { phone: '0933260703', wrongTokenId: 30, correctVoucherId: 'COUPON-e3b83738-7a28-4dac-90a1-c2fab7343881' },
    { phone: '0899236096', wrongTokenId: 32, correctVoucherId: 'COUPON-92a9efc1-48be-4d44-9c9f-ab5245243fcc' },
    { phone: '0863669959', wrongTokenId: 32, correctVoucherId: 'COUPON-d811c94c-9644-42d1-beae-8cc8da16d974' },
    { phone: '0895004537', wrongTokenId: 32, correctVoucherId: 'COUPON-d811c94c-9644-42d1-beae-8cc8da16d974' },
  ];
  
  const merchantId = 'cmmxc3v760003ze01xotjyeot'; // Marketer ID
  
  const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId },
      include: { wallet: true }
  });
  
  if (!merchant || !merchant.wallet) {
      console.error("❌ Merchant หรือ Wallet ของ Marketer ไม่พบ");
      process.exit(1);
  }

  const salt = configService.get<string>('SALT');

  console.log(`\n=== 🛠️ STARTING FIX FOR ${fixDataConfig.length} PHONES ===\n`);

  for (const item of fixDataConfig) {
      console.log(`\n▶ Processing Phone: ${item.phone}`);
      
      const customer = await prisma.customer.findUnique({
          where: { tel: item.phone },
          include: { wallet: true }
      });

      if (!customer || !customer.wallet) {
          console.log(`❌ Skipped: Customer หรือ Wallet ไม่พบ`);
          continue;
      }

      // -------------------------------------------------------------
      // 1. RECOVER WRONG TOKEN (ON-CHAIN + DB)
      // -------------------------------------------------------------
      const wrongCodes = await prisma.voucherCode.findMany({
          where: {
              currentOwnerId: customer.id,
              currentOwnerType: 'CUSTOMER',
              voucher: { tokenId: item.wrongTokenId.toString() }
          },
          include: { voucher: true }
      });

      if (wrongCodes.length > 0) {
          console.log(`- พบข้อมูล Token ${item.wrongTokenId} ที่ผิดพลาดจำนวน ${wrongCodes.length} รายการในกระเป๋าลูกค้า`);
          
          for (const code of wrongCodes) {
             console.log(`  > กำลังกู้คืนคูปอง (Code: ${code.code})`);
             
             // เช็ก On-chain ว่ามีจำนวนอยู่จริงไหม
             const balanceObj = await blockchainService.getUserCouponBalance(customer.wallet.walletAddress, item.wrongTokenId);
             if (balanceObj?.balance >= 1) {
                 // อิมพอร์ตกระเป๋าลูกค้าเพื่อเซ็นโอน Token คืน
                 const decryptedSeed = tokenService.decryptKey(salt, customer.wallet.seedPhrase);
                 const customerSigner = getSignerFromSeedPhrase(decryptedSeed, customer.wallet.derivationIndex);
                 
                 console.log(`  > กำลังทำธุรกรรม On-Chain ดึง Token ${item.wrongTokenId} คืนสู่ Marketer...`);
                 try {
                     const txHash = await blockchainService.transferCoupon(
                         item.wrongTokenId,
                         1, // ดึงคืนทีละ 1 
                         customer.wallet.walletAddress,
                         merchant.wallet.walletAddress,
                         customerSigner.privateKey
                     );
                     console.log(`    ✅ Transfer TX Hash: ${txHash}`);
                 } catch (err: any) {
                     console.log(`    ❌ On-chain transfer ล้มเหลว: ${err.message}`);
                 }
             } else {
                 console.log(`  > ข้ามการดึงคืน On-chain (ยอดของลูกค้า = ${balanceObj?.balance})`);
             }

             // ล้างประวัติใน Database
             try {
                 await prisma.voucherCode.update({
                     where: { id: code.id },
                     data: {
                         currentOwnerId: merchant.id,
                         currentOwnerType: 'MERCHANT'
                     }
                 });
                 console.log(`    ✅ DB updated: คืนความเป็นเจ้าของสู่ Marketer แล้ว`);
                 
                 await prisma.transaction.deleteMany({
                     where: {
                         receiverId: customer.id,
                         type: 'VOUCHER',
                         voucherCodeId: code.id
                     }
                 });
                 console.log(`    ✅ DB updated: ลบประวัติการรับคูปองที่ผิดพลาดหน้าแอป`);
                 
             } catch (err: any) {
                 console.log(`    ❌ ขัดข้องตอนอัปเดต Database: ${err.message}`);
             }
          }
      } else {
          console.log(`- ไม่พบคูปอง Token ${item.wrongTokenId} ค้างอยู่ใน Database ของลูกค้ารายนี้`);
      }

      // -------------------------------------------------------------
      // 2. SEND CORRECT VOUCHER
      // -------------------------------------------------------------
      console.log(`- กำลังทำการแจก Voucher ถูกต้องแทนที่ (Voucher ID: ${item.correctVoucherId})`);
      const hasCorrectCode = await prisma.voucherCode.findFirst({
         where: { currentOwnerId: customer.id, voucherId: item.correctVoucherId }
      });
      
      if (!hasCorrectCode) {
          try {
              const res = await transferHandler.execute({
                merchantId: merchant.id,
                customerPhone: item.phone,
                voucherId: item.correctVoucherId
              });
              console.log(`  ✅ แจกคูปองสำเร็จ! Code ID ที่ลูกค้าได้รับใหม่คือ: ${res?.voucherCodeId || 'N/A'}`);
          } catch (err: any) {
              console.log(`  ❌ ล้มเหลวในการโอนคูปองชดเชย: ${err.message}`);
          }
      } else {
          console.log(`  > ข้าม: พบว่าลูกค้ารายนี้มีคูปองที่ถูกต้องอยู่แล้ว (ID: ${hasCorrectCode.id})`);
      }
  }

  console.log(`\n=== 🎉 DONE ===`);
  await app.close();
  await prisma.$disconnect();
}

main();
