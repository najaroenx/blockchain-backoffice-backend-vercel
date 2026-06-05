import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../prisma/prisma.service';
import { BlockchainService } from '../src/providers/blockchain/blockchain.service';
import { ConfigService } from '@nestjs/config';
import { TokenService } from '../src/providers/token/token.service';
import { getSignerFromSeedPhrase } from '../src/libs/derive-wallet';

// =====================================================
// ⚙️ 4 Batch ที่ต้องการ Re-list ลง Marketplace
// =====================================================
const BATCHES_TO_RELIST = [
  // Token 30
  { batchId: 'cmnd3s47p00wz2s01lywboari', pricePerUnitTHB: 40, label: 'Token30 - 35ชิ้น' },
  { batchId: 'cmngxzejg011i2s0198yod2p2', pricePerUnitTHB: 20, label: 'Token30 - 14ชิ้น' },
  // Token 32
  { batchId: 'cmnd3vh3c00x12s01ebjm0rwj', pricePerUnitTHB: 40, label: 'Token32 - 25ชิ้น' },
  { batchId: 'cmngy2z3i011k2s01f8xf5whh', pricePerUnitTHB: 20, label: 'Token32 - 10ชิ้น' },
];

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error'],
  });

  const prisma = app.get(PrismaService);
  const blockchain = app.get(BlockchainService);
  const config = app.get(ConfigService);
  const tokenService = app.get(TokenService);

  // ใช้ US Point contract address เป็น payment token (ไม่ใช่ THB)
  const US_POINT_CONTRACT = '0xf0822c822f3eada4a7ea6cb19f99ca1329fc0515';
  const US_POINT_ID = 'cmmxeik0c00vize01smxq1w8r';

  const salt = config.get<string>('SALT');
  if (!salt) throw new Error('SALT not set in .env');

  console.log('\n=== Re-listing 4 Batches on Marketplace ===\n');

  let successCount = 0;
  let failCount = 0;

  for (const { batchId, pricePerUnitTHB, label } of BATCHES_TO_RELIST) {
    console.log(`\n📌 [${label}] Batch: ${batchId}`);
    console.log(`   💰 ราคา: ${pricePerUnitTHB} THB/ชิ้น`);

    // 1. ดึง Batch + VoucherCode ทั้งหมด
    const batch = await prisma.listingBatch.findUnique({
      where: { id: batchId },
      include: {
        voucherCodes: {
          include: {
            voucher: { select: { tokenId: true, name: true } },
          },
        },
      },
    });

    if (!batch) {
      console.error(`   ❌ ไม่พบ Batch`);
      failCount++;
      continue;
    }

    // ใช้จำนวน MERCHANT-owned เท่านั้น (ไม่นับที่ขายไปแล้ว)
    const merchantOwnedCodes = batch.voucherCodes.filter(
      (vc) => vc.currentOwnerType === 'MERCHANT',
    );
    const totalItems = merchantOwnedCodes.length;
    const tokenId = batch.voucherCodes[0]?.voucher?.tokenId;
    const sellerWalletAddress = batch.sellerWalletAddress;

    console.log(`   🎫 Token ID: ${tokenId} | 📦 Total: ${batch.voucherCodes.length} | MERCHANT(listable): ${totalItems} ใบ`);
    console.log(`   👛 Seller: ${sellerWalletAddress}`);

    if (!tokenId) {
      console.error(`   ❌ ไม่พบ tokenId`);
      failCount++;
      continue;
    }

    if (totalItems === 0) {
      console.warn(`   ⚠️  ไม่มี MERCHANT-owned codes → ข้ามไป`);
      continue;
    }

    // 2. ดึง Seller Wallet
    const sellerWallet = await prisma.wallet.findFirst({
      where: { walletAddress: sellerWalletAddress.toLowerCase() },
      select: { seedPhrase: true, derivationIndex: true },
    });

    if (!sellerWallet?.seedPhrase) {
      console.error(`   ❌ ไม่พบ Wallet/SeedPhrase สำหรับ ${sellerWalletAddress}`);
      failCount++;
      continue;
    }

    const decryptedSeed = tokenService.decryptKey(salt, sellerWallet.seedPhrase);
    if (!decryptedSeed) {
      console.error(`   ❌ Decrypt seed phrase ไม่สำเร็จ`);
      failCount++;
      continue;
    }

    const signer = getSignerFromSeedPhrase(decryptedSeed, sellerWallet.derivationIndex || 0);

    // 3. Call Blockchain listCoupon()
    console.log(`   🔗 Calling blockchain.listCoupon()...`);
    let listResult: { listingId: string; hash: string };
    try {
      listResult = await (blockchain as any).listCoupon(
        tokenId,
        totalItems,
        pricePerUnitTHB.toString(),
        signer.privateKey,
        US_POINT_CONTRACT, // Payment token = US Point (ไม่ใช่ THB)
      );
    } catch (err: any) {
      console.error(`   ❌ Blockchain ล้มเหลว: ${err.message}`);
      failCount++;
      continue;
    }

    console.log(`   ✅ Listed! New Listing ID: ${listResult.listingId}`);
    console.log(`   🔗 TxHash: ${listResult.hash}`);

    // 4. อัปเดต voucherGroupId เฉพาะ MERCHANT-owned codes เท่านั้น
    const voucherCodeIds = merchantOwnedCodes.map((vc) => vc.id);
    const updated = await prisma.voucherCode.updateMany({
      where: { id: { in: voucherCodeIds } },
      data: {
        voucherGroupId: listResult.listingId,
        pointId: US_POINT_ID,
        currency: 'US', // US Point
      },
    });

    console.log(`   📝 อัปเดต voucherGroupId → ${listResult.listingId}, currency → THB (${updated.count} รายการ)`);

    // 5. อัปเดต Batch status → ACTIVE
    await prisma.listingBatch.update({
      where: { id: batchId },
      data: { status: 'ACTIVE' },
    });

    console.log(`   ✅ Batch status → ACTIVE`);
    console.log(`--------------------------------------------------`);
    successCount++;
  }

  console.log(`\n🎉 เสร็จสิ้น! สำเร็จ ${successCount}/${BATCHES_TO_RELIST.length} Batch`);
  if (failCount > 0) console.log(`⚠️  ล้มเหลว ${failCount} Batch`);

  await app.close();
}

main().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
