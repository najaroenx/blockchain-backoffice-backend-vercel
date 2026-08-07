import { AssetType, ParticipantType, Prisma, PrismaClient } from '@prisma/client';
import { ethers } from 'ethers';

const prisma = new PrismaClient();

const APPLY_FLAG = '--apply';
const TARGET_CUSTOMER_PHONE = '0891673446';
const TARGET_TOKEN_ID = '35';
const ORIGINAL_VOUCHER_CODE_ID = 'cmnd3f6wa005x2s01cmc5mdkr';
const TRANSFER_TRANSACTION_TYPE_ID = 'TRANSFER';
const EXPECTED_ON_CHAIN_BALANCE = 1n;
const REPLACEMENT_CODE_LIMIT = 1;
const COUPON_BALANCE_ABI = [
  'function balanceOf(address account, uint256 id) view returns (uint256)',
];

interface ReplacementVoucherCode {
  id: string;
  listingBatchId: string | null;
}

interface RepairContext {
  customerId: string;
  customerWalletAddress: string;
  originalCode: {
    id: string;
    voucherId: string;
    voucherGroupId: string | null;
    listingBatchId: string | null;
    isUsed: boolean;
    usedBy: string | null;
    voucher: { tokenId: string | null };
  };
  transactionId: string;
  merchantId: string;
}

function shouldApply(): boolean {
  return process.argv.includes(APPLY_FLAG);
}

function getRequiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} must be configured`);
  return value;
}

function getTargetTransactionHash(): string {
  const hash = getRequiredEnvironment('TOKEN_35_PURCHASE_TX_HASH')
    .replace(/^0x/, '')
    .toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(hash)) {
    throw new Error('TOKEN_35_PURCHASE_TX_HASH must be a full 32-byte transaction hash');
  }
  return hash;
}

function matchesTargetTransactionHash(
  txHash: Uint8Array,
  targetTransactionHash: string,
): boolean {
  return Buffer.from(txHash).toString('hex').toLowerCase() === targetTransactionHash;
}

async function verifyOnChainBalance(walletAddress: string): Promise<void> {
  const provider = new ethers.JsonRpcProvider(getRequiredEnvironment('RPC_URL'));
  const couponContract = new ethers.Contract(
    getRequiredEnvironment('COUPON_ADDRESS'),
    COUPON_BALANCE_ABI,
    provider,
  );
  const balance = (await couponContract.balanceOf(
    walletAddress,
    BigInt(TARGET_TOKEN_ID),
  )) as bigint;

  if (balance !== EXPECTED_ON_CHAIN_BALANCE) {
    throw new Error(
      `Target wallet has ${balance.toString()} Token #${TARGET_TOKEN_ID}; expected exactly ${EXPECTED_ON_CHAIN_BALANCE.toString()}`,
    );
  }
}

async function loadRepairContext(
  targetTransactionHash: string,
): Promise<RepairContext | null> {
  const customer = await prisma.customer.findUnique({
    where: { tel: TARGET_CUSTOMER_PHONE },
    select: {
      id: true,
      wallet: { select: { walletAddress: true } },
    },
  });
  if (!customer?.wallet?.walletAddress) {
    throw new Error('Target customer or wallet was not found');
  }

  const originalCode = await prisma.voucherCode.findUnique({
    where: { id: ORIGINAL_VOUCHER_CODE_ID },
    select: {
      id: true,
      voucherId: true,
      voucherGroupId: true,
      listingBatchId: true,
      isUsed: true,
      usedBy: true,
      voucher: { select: { tokenId: true } },
    },
  });
  if (!originalCode) throw new Error('Original voucher code was not found');

  const transactions = await prisma.transaction.findMany({
    where: {
      receiverId: customer.id,
      senderType: ParticipantType.MERCHANT,
      receiverType: ParticipantType.CUSTOMER,
      transactionTypeId: TRANSFER_TRANSACTION_TYPE_ID,
      type: AssetType.VOUCHER,
    },
    select: { id: true, txHash: true, voucherCodeId: true, senderId: true },
  });
  const matches = transactions.filter((transaction) =>
    matchesTargetTransactionHash(transaction.txHash, targetTransactionHash),
  );

  if (matches.length !== REPLACEMENT_CODE_LIMIT) {
    throw new Error('Expected exactly one target VOUCHER transfer transaction');
  }

  const targetTransaction = matches[0];
  if (!targetTransaction.senderId) {
    throw new Error('Target transaction has no merchant sender');
  }

  if (targetTransaction.voucherCodeId !== ORIGINAL_VOUCHER_CODE_ID) {
    await assertAlreadyRepaired(targetTransaction.voucherCodeId, customer.id);
    return null;
  }

  assertOriginalCode(originalCode, customer.id);
  return {
    customerId: customer.id,
    customerWalletAddress: customer.wallet.walletAddress,
    originalCode,
    transactionId: targetTransaction.id,
    merchantId: targetTransaction.senderId,
  };
}

function assertOriginalCode(
  originalCode: RepairContext['originalCode'],
  customerId: string,
): void {
  if (originalCode.voucher.tokenId !== TARGET_TOKEN_ID) {
    throw new Error('Original code does not belong to Token #35');
  }
  if (!originalCode.isUsed || !originalCode.usedBy) {
    throw new Error('Original code has not been redeemed');
  }
  if (originalCode.usedBy === customerId) {
    throw new Error('Original code was redeemed by the target customer');
  }
  if (!originalCode.voucherGroupId || !originalCode.listingBatchId) {
    throw new Error('Original code is not tied to an active marketplace listing');
  }
}

async function assertAlreadyRepaired(
  voucherCodeId: string | null,
  customerId: string,
): Promise<void> {
  if (!voucherCodeId) throw new Error('Target transaction has no voucher code');

  const mappedCode = await prisma.voucherCode.findUnique({
    where: { id: voucherCodeId },
    select: {
      currentOwnerId: true,
      currentOwnerType: true,
      isUsed: true,
      voucher: { select: { tokenId: true } },
    },
  });
  if (
    !mappedCode ||
    mappedCode.voucher.tokenId !== TARGET_TOKEN_ID ||
    mappedCode.currentOwnerId !== customerId ||
    mappedCode.currentOwnerType !== ParticipantType.CUSTOMER ||
    mappedCode.isUsed
  ) {
    throw new Error('Target transaction points to an unexpected voucher code');
  }

  console.log('Repair already applied; no database changes made.');
}

async function applyRepair(context: RepairContext): Promise<void> {
  const { customerId, originalCode, transactionId, merchantId } = context;

  await prisma.$transaction(async (transaction) => {
    const listingBatch = await transaction.listingBatch.findUnique({
      where: { id: originalCode.listingBatchId! },
      select: { id: true, status: true },
    });
    if (!listingBatch || listingBatch.status !== 'ACTIVE') {
      throw new Error('Original listing batch is not active');
    }

    const replacementCodes = await transaction.$queryRaw<ReplacementVoucherCode[]>(
      Prisma.sql`
        SELECT id, "listingBatchId"
        FROM "VoucherCode"
        WHERE "voucherId" = ${originalCode.voucherId}
          AND "voucherGroupId" = ${originalCode.voucherGroupId!}
          AND "listingBatchId" = ${originalCode.listingBatchId!}
          AND "currentOwnerId" = ${merchantId}
          AND "currentOwnerType" = ${ParticipantType.MERCHANT}
          AND "isUsed" = false
          AND id <> ${ORIGINAL_VOUCHER_CODE_ID}
        ORDER BY id ASC
        LIMIT ${REPLACEMENT_CODE_LIMIT}
        FOR UPDATE SKIP LOCKED
      `,
    );
    const replacementCode = replacementCodes[0];
    if (!replacementCode) {
      throw new Error('No unlocked replacement code is available in the merchant listing');
    }

    const ownershipUpdate = await transaction.voucherCode.updateMany({
      where: {
        id: replacementCode.id,
        currentOwnerId: merchantId,
        currentOwnerType: ParticipantType.MERCHANT,
        isUsed: false,
      },
      data: {
        currentOwnerId: customerId,
        currentOwnerType: ParticipantType.CUSTOMER,
        isUsed: false,
        usedBy: null,
        usedAt: null,
      },
    });
    if (ownershipUpdate.count !== REPLACEMENT_CODE_LIMIT) {
      throw new Error('Replacement code changed before it could be assigned');
    }

    const transactionUpdate = await transaction.transaction.updateMany({
      where: { id: transactionId, voucherCodeId: ORIGINAL_VOUCHER_CODE_ID },
      data: { voucherCodeId: replacementCode.id },
    });
    if (transactionUpdate.count !== REPLACEMENT_CODE_LIMIT) {
      throw new Error('Target transaction changed before it could be re-linked');
    }

    const updatedBatch = await transaction.listingBatch.update({
      where: { id: listingBatch.id },
      data: { soldItems: { increment: REPLACEMENT_CODE_LIMIT } },
      select: { totalItems: true, soldItems: true },
    });
    if (updatedBatch.soldItems >= updatedBatch.totalItems) {
      await transaction.listingBatch.update({
        where: { id: listingBatch.id },
        data: { status: 'SOLD_OUT' },
      });
    }

    console.log(`Assigned replacement VoucherCode ${replacementCode.id} and re-linked the target transaction.`);
  });
}

async function main(): Promise<void> {
  const context = await loadRepairContext(getTargetTransactionHash());
  if (!context) return;

  await verifyOnChainBalance(context.customerWalletAddress);
  if (!shouldApply()) {
    console.log('Dry run passed. Re-run with --apply to perform the DB-only repair.');
    return;
  }

  // This repair changes only DB allocation and ledger mapping; it never submits an on-chain transaction.
  await applyRepair(context);
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[FATAL] ${message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });