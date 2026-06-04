import { AssetType, PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { ethers } from 'ethers';

/**
 * Phase 2 — DB sync (runs on deploy inside the container)
 *
 * For each FAIL customer from Phase 1:
 *   1. Finds (or claims from stock) the matching VoucherCode in DB
 *   2. Transfers ownership to the customer
 *   3. Creates the Transaction record for the on-chain mint that happened in Phase 1
 *
 * Idempotent: skips any row whose txHash already exists in the Transaction table.
 *
 * ⚠️  Fill in txHashHex values from fix-failed-airdrop-phase1.ts output BEFORE deploying.
 */

const prisma = new PrismaClient();

interface FixRow {
  tel: string;
  /** ERC-1155 tokenId as stored in Voucher.tokenId (string) */
  tokenId: string;
  /** 0x-prefixed tx hash from Phase 1 mint. Set to FILL_AFTER_PHASE1 until Phase 1 runs. */
  txHashHex: string;
}

// prettier-ignore
const FIXES: FixRow[] = [
  { tel: '0819259399', tokenId: '33', txHashHex: '0xbd08d9182e1f9955b384a94c4c861db3eeefabfe1e386139e482a00423abe91e' }, // tinyhomeari -30฿ (test mint)
  { tel: '0628358181', tokenId: '33', txHashHex: '0x8c40cde6ebbd2579c12d08f6a5aa27e718d3b83cfe3916b6a1f9a0c04f141aa9' }, // tinyhomeari -30฿
  { tel: '0909855171', tokenId: '35', txHashHex: '0xcb064c6475ac14793243717012f2675a9f2cd5719428010ef3fa0c589d4469f5' }, // realcoffee -20฿
  { tel: '0899612224', tokenId: '35', txHashHex: '0x731ca824ade4a847c3681f2ad3d99af781a32f2e8d1ceb122646e42627e10cb1' }, // realcoffee -20฿
  { tel: '0944952886', tokenId: '35', txHashHex: '0x00409616395f1f1a4a0ff2ff9b7bffe8864f3d6ba5c1b0a38bdb0a991e754a0b' }, // realcoffee -20฿
];

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) throw new Error('PRIVATE_KEY not in env');

  // Derive admin wallet address from private key (no RPC call needed for address derivation)
  const adminAddress = new ethers.Wallet(privateKey).address;
  console.log(`Admin address : ${adminAddress}`);

  let fixedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  const divider = '─'.repeat(70);

  for (const row of FIXES) {
    console.log(divider);

    if (row.txHashHex === 'FILL_AFTER_PHASE1') {
      console.log(`⚠️  SKIP   tel=${row.tel} tokenId=${row.tokenId} — txHash not filled in yet`);
      skippedCount++;
      continue;
    }

    const txHashBuf = Buffer.from(row.txHashHex.replace(/^0x/, ''), 'hex');

    // Idempotent: skip if Transaction already recorded for this txHash
    const existing = await prisma.transaction.findFirst({
      where: { txHash: txHashBuf },
    });
    if (existing) {
      console.log(`⏭️  SKIP   tel=${row.tel} tokenId=${row.tokenId} — Transaction already exists (id=${existing.id})`);
      skippedCount++;
      continue;
    }

    // Find customer
    const customer = await prisma.customer.findUnique({
      where: { tel: row.tel },
      include: { wallet: true },
    });
    if (!customer?.wallet?.walletAddress) {
      console.error(`❌ ERROR  tel=${row.tel} — customer or wallet not found in DB`);
      errorCount++;
      continue;
    }

    // Find voucher by tokenId (tokenId is unique on Voucher model)
    const voucher = await prisma.voucher.findFirst({
      where: { tokenId: row.tokenId },
    });
    if (!voucher) {
      console.error(`❌ ERROR  tel=${row.tel} — no Voucher with tokenId=${row.tokenId} found`);
      errorCount++;
      continue;
    }

    // Check if this customer already owns a VoucherCode for this voucher
    let voucherCode = await prisma.voucherCode.findFirst({
      where: { voucherId: voucher.id, currentOwnerId: customer.id, currentOwnerType: 'CUSTOMER' },
    });
    let claimedFromStock = false;

    if (!voucherCode) {
      // Claim the first available code from merchant or system stock
      voucherCode = await prisma.voucherCode.findFirst({
        where: {
          voucherId: voucher.id,
          currentOwnerType: { in: ['MERCHANT', 'SYSTEM'] },
          isUsed: false,
        },
      });
      if (!voucherCode) {
        console.error(
          `❌ ERROR  tel=${row.tel} voucherId=${voucher.id} — no available VoucherCode in stock (MERCHANT or SYSTEM)`,
        );
        errorCount++;
        continue;
      }
      claimedFromStock = true;
    }

    const adminAddressBuf = Buffer.from(adminAddress.replace(/^0x/, ''), 'hex');
    const receiverAddressBuf = Buffer.from(customer.wallet.walletAddress.replace(/^0x/, ''), 'hex');

    try {
      await prisma.$transaction(async (tx) => {
        if (claimedFromStock) {
          await tx.voucherCode.update({
            where: { id: voucherCode!.id },
            data: {
              currentOwnerId: customer.id,
              currentOwnerType: 'CUSTOMER',
              voucherGroupId: null,
            },
          });
        }

        await tx.transaction.create({
          data: {
            txHash: txHashBuf,
            amount: 1,
            senderAddress: adminAddressBuf,
            receiverAddress: receiverAddressBuf,
            senderId: null,
            senderType: 'SYSTEM',
            receiverId: customer.id,
            receiverType: 'CUSTOMER',
            merchantId: null,
            transactionTypeId: 'TRANSFER',
            type: AssetType.VOUCHER,
            voucherCodeId: voucherCode!.id,
            transactionRefId: randomUUID(),
          },
        });
      });

      console.log(
        `✅ FIXED  tel=${row.tel} | tokenId=${row.tokenId} | voucherCodeId=${voucherCode.id}` +
          (claimedFromStock ? ' (claimed from stock)' : ' (customer already owned code)'),
      );
      fixedCount++;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`❌ ERROR  tel=${row.tel} — DB transaction failed: ${message}`);
      errorCount++;
    }
  }

  // ── Cleanup: คืน VoucherCode tokenId 32 ที่ผิดกลับ merchant ──
  // Original airdrop มิ้น tokenId 32 (ผิด) ให้ลูกค้าด้านล่างนี้ทุกคน
  // แต่ละคนยังมี tokenId 32 VoucherCode ใน DB — block นี้คืนกลับ merchant
  const WRONG_TOKEN_CLEANUPS = [
    { tel: '0819259399', wrongTokenId: '32' },
    { tel: '0628358181', wrongTokenId: '32' },
  ];

  for (const cleanup of WRONG_TOKEN_CLEANUPS) {
    console.log(divider);
    console.log(`🔧 CLEANUP  tel=${cleanup.tel} | returning wrongly-airdropped tokenId ${cleanup.wrongTokenId} VoucherCode to merchant...`);
    const cleanupCustomer = await prisma.customer.findUnique({ where: { tel: cleanup.tel } });
    if (!cleanupCustomer) {
      console.log(`⏭️  CLEANUP SKIP — customer ${cleanup.tel} not found`);
      continue;
    }
    const wrongCode = await prisma.voucherCode.findFirst({
      where: {
        currentOwnerId: cleanupCustomer.id,
        currentOwnerType: 'CUSTOMER',
        voucher: { tokenId: cleanup.wrongTokenId },
      },
      include: { voucher: { select: { merchantId: true } } },
    });
    if (!wrongCode) {
      console.log(`⏭️  CLEANUP SKIP — tokenId ${cleanup.wrongTokenId} VoucherCode already not owned by customer ${cleanup.tel}`);
    } else {
      await prisma.voucherCode.update({
        where: { id: wrongCode.id },
        data: { currentOwnerId: wrongCode.voucher.merchantId, currentOwnerType: 'MERCHANT' },
      });
      console.log(`✅ CLEANUP DONE — VoucherCode ${wrongCode.id} (tokenId ${cleanup.wrongTokenId}) returned to merchant ${wrongCode.voucher.merchantId}`);
    }
  }

  const equalsDivider = '='.repeat(70);
  console.log(`\n${equalsDivider}`);
  console.log(`SUMMARY  ✅ FIXED: ${fixedCount}  ⏭️  SKIPPED: ${skippedCount}  ❌ ERROR: ${errorCount}`);
  console.log(equalsDivider);

  if (errorCount > 0) {
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
