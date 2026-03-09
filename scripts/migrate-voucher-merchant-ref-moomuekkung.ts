import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TARGET_VOUCHER_ID = 'COUPON-d73ef169-411d-4deb-ba19-940d1f2b50d7';
const TARGET_MERCHANT_REF_STORE_ID = 'cmmbwr8eo000000012cf7ba35';
const TARGET_MERCHANT_REF = 'moomuekkung';
const TARGET_MERCHANT_NAME = 'ร้านหมูหมึกกุ้ง';

async function migrateVoucherMerchantRef() {
  const isDryRun = process.argv.includes('--dry-run');

  console.log(
    `[START] ${isDryRun ? 'Dry-run m' : 'M'}igrating voucher merchantRef for ${TARGET_VOUCHER_ID}`,
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

    console.log('[STEP 2] Loading target voucher...');
    const voucher = await prisma.voucher.findUnique({
      where: { id: TARGET_VOUCHER_ID },
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

    if (!voucher) {
      throw new Error(`Voucher ${TARGET_VOUCHER_ID} not found`);
    }

    console.log('[CURRENT] Voucher state:');
    console.log(
      JSON.stringify(
        {
          id: voucher.id,
          name: voucher.name,
          merchantId: voucher.merchantId,
          sellerMerchantId: voucher.sellerMerchantId,
          merchantName: voucher.merchantName,
          merchantRef: voucher.merchantRef,
          updatedAt: voucher.updatedAt,
        },
        null,
        2,
      ),
    );

    console.log('[TARGET] MerchantRefStore detail:');
    console.log(JSON.stringify(merchantRefStore, null, 2));

    const nextData = {
      merchantRef: merchantRefStore.merchantRef,
      merchantName: merchantRefStore.name || TARGET_MERCHANT_NAME,
    };

    const hasChanges =
      voucher.merchantRef !== nextData.merchantRef ||
      voucher.merchantName !== nextData.merchantName;

    if (!hasChanges) {
      console.log('[INFO] Voucher already uses the target merchantRef and merchantName.');
      return;
    }

    if (isDryRun) {
      console.log('[DRY-RUN] Voucher would be updated with:');
      console.log(JSON.stringify(nextData, null, 2));
      return;
    }

    console.log('[STEP 3] Updating voucher...');
    const updatedVoucher = await prisma.voucher.update({
      where: { id: TARGET_VOUCHER_ID },
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

    console.log('[SUCCESS] Voucher updated successfully:');
    console.log(JSON.stringify(updatedVoucher, null, 2));
  } catch (error) {
    console.error('[FATAL ERROR] Migration failed:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void migrateVoucherMerchantRef();