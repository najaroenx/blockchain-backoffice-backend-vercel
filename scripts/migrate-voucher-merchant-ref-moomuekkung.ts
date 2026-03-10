import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TARGET_VOUCHER_IDS = [
  'COUPON-d73ef169-411d-4deb-ba19-940d1f2b50d7',
  'COUPON-ef81bb85-9cd1-4dde-9dd3-f8ade72827f9',
];
const TARGET_MERCHANT_REF_STORE_ID = 'cmmbwr8eo000000012cf7ba35';
const TARGET_MERCHANT_REF = 'moomuekkung';
const TARGET_MERCHANT_NAME = 'ร้านหมูหมึกกุ้ง';

async function migrateVoucherMerchantRef() {
  const isDryRun = process.argv.includes('--dry-run');

  console.log(
    `[START] ${isDryRun ? 'Dry-run m' : 'M'}igrating voucher merchantRef for ${TARGET_VOUCHER_IDS.length} vouchers`,
  );

  try {
    console.log('[STEP 1] Validating MerchantRefStore record...');
    const merchantRefStore = await prisma.merchantRefStore.findUnique({
      where: { id: TARGET_MERCHANT_REF_STORE_ID },
      select: {
        id: true,
        merchantRef: true,
        name: true,
        category: true,
        description: true,
        imageUrl: true,
        locationUrl: true,
        website: true,
        isActive: true,
      },
    });

    if (!merchantRefStore) {
      throw new Error(
        `MerchantRefStore ${TARGET_MERCHANT_REF_STORE_ID} not found`,
      );
    }

    if (merchantRefStore.merchantRef !== TARGET_MERCHANT_REF) {
      throw new Error(
        `MerchantRef mismatch. Expected ${TARGET_MERCHANT_REF}, got ${merchantRefStore.merchantRef}`,
      );
    }

    console.log('[TARGET] MerchantRefStore detail:');
    console.log(JSON.stringify(merchantRefStore, null, 2));

    const nextData = {
      merchantRef: merchantRefStore.merchantRef,
      merchantName: merchantRefStore.name || TARGET_MERCHANT_NAME,
    };

    console.log('[STEP 2] Loading target vouchers...');
    const vouchers = await prisma.voucher.findMany({
      where: { id: { in: TARGET_VOUCHER_IDS } },
      select: {
        id: true,
        name: true,
        merchantId: true,
        sellerMerchantId: true,
        merchantName: true,
        merchantRef: true,
        updatedAt: true,
      },
      orderBy: { id: 'asc' },
    });

    const foundIds = new Set(vouchers.map((voucher) => voucher.id));
    const missingIds = TARGET_VOUCHER_IDS.filter((id) => !foundIds.has(id));

    if (missingIds.length > 0) {
      throw new Error(`Vouchers not found: ${missingIds.join(', ')}`);
    }

    console.log('[CURRENT] Voucher states:');
    console.log(JSON.stringify(vouchers, null, 2));

    const vouchersToUpdate = vouchers.filter(
      (voucher) =>
        voucher.merchantRef !== nextData.merchantRef ||
        voucher.merchantName !== nextData.merchantName,
    );

    if (vouchersToUpdate.length === 0) {
      console.log('[INFO] All target vouchers already use the target merchantRef and merchantName.');
      return;
    }

    if (isDryRun) {
      console.log('[DRY-RUN] Vouchers that would be updated:');
      console.log(
        JSON.stringify(
          vouchersToUpdate.map((voucher) => ({
            id: voucher.id,
            currentMerchantRef: voucher.merchantRef,
            currentMerchantName: voucher.merchantName,
            nextMerchantRef: nextData.merchantRef,
            nextMerchantName: nextData.merchantName,
          })),
          null,
          2,
        ),
      );
      return;
    }

    console.log(
      `[STEP 3] Updating ${vouchersToUpdate.length} vouchers...`,
    );

    const updatedVouchers = [];
    for (const voucher of vouchersToUpdate) {
      const updatedVoucher = await prisma.voucher.update({
        where: { id: voucher.id },
        data: nextData,
        select: {
          id: true,
          name: true,
          merchantId: true,
          sellerMerchantId: true,
          merchantName: true,
          merchantRef: true,
          updatedAt: true,
        },
      });

      updatedVouchers.push(updatedVoucher);
    }

    console.log('[SUCCESS] Vouchers updated successfully:');
    console.log(JSON.stringify(updatedVouchers, null, 2));
  } catch (error) {
    console.error('[FATAL ERROR] Migration failed:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void migrateVoucherMerchantRef();