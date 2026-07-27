import { randomUUID } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import {
  AssetType,
  TransactionTypeId,
} from 'src/constants/transaction-types.enum';
import { getSignerFromSeedPhrase } from 'src/libs/derive-wallet';
import { PrismaService } from 'prisma/prisma.service';
import type { BlockchainService } from 'src/providers/blockchain/blockchain.service';
import { TokenService } from 'src/providers/token/token.service';

interface WalletLike {
  walletAddress: string;
}

interface SeedPhraseWalletLike extends WalletLike {
  seedPhrase: string | null;
  derivationIndex: number;
}

interface MerchantLike {
  id: string;
  wallet: WalletLike;
}

interface MerchantWithSeedPhraseLike {
  wallet: SeedPhraseWalletLike;
}

interface CustomerLike {
  id: string;
  wallet: WalletLike;
}

interface VoucherLike {
  merchantRef?: string | null;
}

export interface DirectTransferAuditContext {
  recoveryRunId?: string;
  actorType: 'ADMIN' | 'APPLICATION';
  actorId?: string;
  action:
    | 'OPERATION_CONFIRMED'
    | 'DB_FINALIZED'
    | 'CLAIM_RELEASED'
    | 'MARKED_DB_FAILED'
    | 'MARKED_MANUAL_REVIEW';
  fromStatus?: any;
  txHash?: string;
  receiptStatus?: number;
  metadata?: Record<string, unknown>;
}

interface ExecuteDirectVoucherTransferParams {
  prisma: PrismaService;
  blockchainService: Pick<
    BlockchainService,
    'submitCouponTransfer' | 'waitForCouponTransferReceipt'
  >;
  merchant: MerchantLike;
  customer: CustomerLike;
  voucher: VoucherLike;
  voucherId: string;
  typeId: number;
  quantity: number;
  merchantPrivateKey: string;
}

export interface ExecutedDirectVoucherTransfer {
  operationId: string;
  txHash: string;
  voucherCodes: any[];
  transactions: any[];
}

export interface DirectVoucherTransferFailure extends Error {
  directTransferOperationId?: string;
  transactionHash?: string;
  chainConfirmed?: boolean;
  statusPersistenceError?: unknown;
}

export interface WriteDirectVoucherTransferLedgerParams {
  prisma: any;
  voucherCodeIds: string[];
  merchant: MerchantLike;
  customer: CustomerLike;
  voucher: VoucherLike;
  txHash: string;
  transactionRefId?: string;
  operationId?: string;
  auditContext?: DirectTransferAuditContext;
}

export interface LockAvailableMerchantVoucherCodesParams {
  voucherId: string;
  merchantId: string;
  quantity: number;
}

export interface PrepareDirectTransferOperationParams
  extends LockAvailableMerchantVoucherCodesParams {
  customerId: string;
}

export interface PreparedDirectTransferOperation {
  operationId: string;
  voucherCodes: any[];
}

export function directTransferWalletPoolWhere(params: {
  merchantId?: string;
  voucherId?: string;
  voucherIds?: string[];
}): Prisma.VoucherCodeWhereInput {
  const { merchantId, voucherId, voucherIds } = params;

  return {
    ...(voucherId
      ? { voucherId }
      : voucherIds
        ? { voucherId: { in: voucherIds } }
        : {}),
    ...(merchantId ? { currentOwnerId: merchantId } : {}),
    currentOwnerType: 'MERCHANT',
    isUsed: false,
    voucherGroupId: null,
    pointId: null,
    directTransferOperationId: null,
  };
}

export function insufficientWalletPoolError(params: {
  voucherId: string;
  requested: number;
  available: number;
}): BadRequestException {
  const { voucherId, requested, available } = params;
  return new BadRequestException({
    statusCode: 400,
    code: 'INSUFFICIENT_WALLET_POOL',
    message: `Insufficient Wallet Pool stock. Requested ${requested}, available ${available}.`,
    voucherId,
    requested,
    available,
  });
}

function hexAddressToBuffer(address: string): Buffer {
  return Buffer.from(address.replace(/^0x/, ''), 'hex');
}

function txHashToBuffer(txHash: string): Buffer {
  return Buffer.from(txHash.replace(/^0x/, ''), 'hex');
}

export async function lockAvailableMerchantVoucherCodes(
  prisma: PrismaService,
  { voucherId, merchantId, quantity }: LockAvailableMerchantVoucherCodesParams,
): Promise<any[]> {
  return prisma.$queryRawUnsafe<any[]>(
    `
    SELECT * FROM "VoucherCode"
    WHERE "voucherId" = $1
      AND "currentOwnerId" = $2
      AND "currentOwnerType" = 'MERCHANT'
      AND "isUsed" = false
      AND "voucherGroupId" IS NULL
      AND "pointId" IS NULL
      AND "directTransferOperationId" IS NULL
    ORDER BY "id" ASC
    LIMIT $3
    FOR UPDATE SKIP LOCKED
  `,
    voucherId,
    merchantId,
    quantity,
  );
}

export async function prepareDirectTransferOperation(
  prisma: PrismaService,
  {
    voucherId,
    merchantId,
    customerId,
    quantity,
  }: PrepareDirectTransferOperationParams,
): Promise<PreparedDirectTransferOperation> {
  return prisma.$transaction(async (tx) => {
    const voucherCodes = await lockAvailableMerchantVoucherCodes(tx as any, {
      voucherId,
      merchantId,
      quantity,
    });

    if (!voucherCodes || voucherCodes.length < quantity) {
      throw insufficientWalletPoolError({
        voucherId,
        requested: quantity,
        available: voucherCodes?.length || 0,
      });
    }

    const voucherCodeIds = voucherCodes.map((code) => code.id);
    const operation = await tx.directTransferOperation.create({
      data: {
        merchantId,
        customerId,
        voucherId,
        quantity,
        reservedVoucherCodeIds: voucherCodeIds,
        sourcePool: 'WALLET_POOL',
        status: 'PREPARED',
      },
    });

    const claimResult = await tx.voucherCode.updateMany({
      where: {
        id: { in: voucherCodeIds },
        directTransferOperationId: null,
      },
      data: {
        directTransferOperationId: operation.id,
      },
    });

    if (claimResult.count !== voucherCodeIds.length) {
      throw new BadRequestException({
        statusCode: 409,
        code: 'VOUCHER_RESERVATION_CONFLICT',
        message: 'Voucher stock changed while preparing the transfer.',
        voucherId,
      });
    }

    return {
      operationId: operation.id,
      voucherCodes,
    };
  });
}

export async function markDirectTransferOperationSubmitted(
  prisma: PrismaService,
  operationId: string,
  txHash: string,
): Promise<void> {
  await prisma.directTransferOperation.update({
    where: { id: operationId },
    data: {
      status: 'SUBMITTED',
      txHash,
      submittedAt: new Date(),
    },
  });
}

export async function releaseDirectTransferOperation(
  prisma: PrismaService,
  operationId: string,
  error: unknown,
  auditContext?: DirectTransferAuditContext,
): Promise<void> {
  const errorNote = error instanceof Error ? error.message : String(error);

  await prisma.$transaction(async (tx) => {
    await tx.voucherCode.updateMany({
      where: { directTransferOperationId: operationId },
      data: { directTransferOperationId: null },
    });
    await tx.directTransferOperation.update({
      where: { id: operationId },
      data: {
        status: 'CHAIN_FAILED',
        errorNote,
      },
    });
    if (auditContext) {
      await tx.directTransferOperationEvent.create({
        data: {
          recoveryRunId: auditContext.recoveryRunId,
          operationId,
          actorType: auditContext.actorType,
          actorId: auditContext.actorId,
          action: auditContext.action,
          fromStatus: auditContext.fromStatus,
          toStatus: 'CHAIN_FAILED',
          txHash: auditContext.txHash,
          receiptStatus: auditContext.receiptStatus,
          errorNote,
          metadata: auditContext.metadata as any,
        },
      });
    }
  });
}

export async function markDirectTransferOperationManualReview(
  prisma: PrismaService,
  operationId: string,
  error: unknown,
): Promise<void> {
  const errorNote = error instanceof Error ? error.message : String(error);

  await prisma.directTransferOperation.update({
    where: { id: operationId },
    data: {
      status: 'MANUAL_REVIEW',
      errorNote,
    },
  });
}

export async function markDirectTransferOperationDbFailed(
  prisma: PrismaService,
  operationId: string,
  error: unknown,
): Promise<void> {
  const errorNote = error instanceof Error ? error.message : String(error);

  await prisma.directTransferOperation.update({
    where: { id: operationId },
    data: {
      status: 'DB_FAILED',
      errorNote,
    },
  });
}

export async function executeDirectVoucherTransfer({
  prisma,
  blockchainService,
  merchant,
  customer,
  voucher,
  voucherId,
  typeId,
  quantity,
  merchantPrivateKey,
}: ExecuteDirectVoucherTransferParams): Promise<ExecutedDirectVoucherTransfer> {
  let operationId: string | undefined;
  let txHash: string | undefined;
  let chainConfirmed = false;

  try {
    const preparedOperation = await prepareDirectTransferOperation(prisma, {
      voucherId,
      merchantId: merchant.id,
      customerId: customer.id,
      quantity,
    });
    operationId = preparedOperation.operationId;

    txHash = await blockchainService.submitCouponTransfer(
      typeId,
      quantity,
      merchant.wallet.walletAddress,
      customer.wallet.walletAddress,
      merchantPrivateKey,
    );
    await markDirectTransferOperationSubmitted(prisma, operationId, txHash);
    await blockchainService.waitForCouponTransferReceipt(txHash);
    chainConfirmed = true;

    const voucherCodeIds = preparedOperation.voucherCodes.map(
      (code) => code.id,
    );
    const transactions = await writeDirectVoucherTransferLedger({
      prisma,
      voucherCodeIds,
      merchant,
      customer,
      voucher,
      txHash,
      operationId,
    });

    return {
      operationId,
      txHash,
      voucherCodes: preparedOperation.voucherCodes,
      transactions,
    };
  } catch (error) {
    const contextualError: DirectVoucherTransferFailure =
      error instanceof Error ? error : new Error(String(error));
    contextualError.directTransferOperationId = operationId;
    contextualError.transactionHash = txHash;
    contextualError.chainConfirmed = chainConfirmed;

    if (operationId) {
      try {
        const errorCode = (error as { code?: string })?.code;
        if (txHash && errorCode === 'COUPON_TRANSFER_REVERTED') {
          await releaseDirectTransferOperation(prisma, operationId, error);
        } else if (chainConfirmed) {
          await markDirectTransferOperationDbFailed(prisma, operationId, error);
        } else {
          await markDirectTransferOperationManualReview(
            prisma,
            operationId,
            error,
          );
        }
      } catch (statusPersistenceError) {
        contextualError.statusPersistenceError = statusPersistenceError;
      }
    }
    throw contextualError;
  }
}

export function getMerchantPrivateKey(
  configService: ConfigService,
  tokenService: TokenService,
  merchant: MerchantWithSeedPhraseLike,
): string {
  const salt = configService.get<string>('SALT');
  if (!salt) {
    throw new Error('SALT not found in config service');
  }

  const decryptedSeedPhrase = tokenService.decryptKey(
    salt,
    merchant.wallet.seedPhrase,
  );
  if (!decryptedSeedPhrase) {
    throw new Error('Failed to decrypt merchant seed phrase');
  }

  const merchantSigner = getSignerFromSeedPhrase(
    decryptedSeedPhrase,
    merchant.wallet.derivationIndex,
  );
  return merchantSigner.privateKey;
}

export async function writeDirectVoucherTransferLedger({
  prisma,
  voucherCodeIds,
  merchant,
  customer,
  voucher,
  txHash,
  transactionRefId,
  operationId,
  auditContext,
}: WriteDirectVoucherTransferLedgerParams): Promise<any[]> {
  const txHashBuffer = txHashToBuffer(txHash);
  const senderAddressBuffer = hexAddressToBuffer(merchant.wallet.walletAddress);
  const receiverAddressBuffer = hexAddressToBuffer(
    customer.wallet.walletAddress,
  );

  return prisma.$transaction(async (tx) => {
    const ownershipUpdate = await tx.voucherCode.updateMany({
      where: {
        id: { in: voucherCodeIds },
        ...(operationId ? { directTransferOperationId: operationId } : {}),
      },
      data: {
        currentOwnerId: customer.id,
        currentOwnerType: 'CUSTOMER',
        voucherGroupId: null,
      },
    });

    if (ownershipUpdate.count !== voucherCodeIds.length) {
      throw new Error(
        `Reserved voucher code mismatch for operation ${operationId || 'legacy'}: expected ${voucherCodeIds.length}, updated ${ownershipUpdate.count}`,
      );
    }

    const transactions = await Promise.all(
      voucherCodeIds.map((codeId) =>
        tx.transaction.create({
          data: {
            txHash: txHashBuffer,
            amount: 1,
            senderAddress: senderAddressBuffer,
            receiverAddress: receiverAddressBuffer,
            merchantId: merchant.id,
            merchantRef: voucher.merchantRef || null,
            voucherCodeId: codeId,
            senderId: merchant.id,
            receiverId: customer.id,
            senderType: 'MERCHANT',
            receiverType: 'CUSTOMER',
            transactionTypeId: TransactionTypeId.TRANSFER,
            type: AssetType.VOUCHER,
            sourcePool: 'WALLET_POOL',
            transactionRefId: transactionRefId || operationId || randomUUID(),
          },
        }),
      ),
    );

    if (operationId) {
      await tx.directTransferOperation.update({
        where: { id: operationId },
        data: {
          status: 'CONFIRMED',
          txHash,
          confirmedAt: new Date(),
        },
      });
      if (auditContext) {
        await tx.directTransferOperationEvent.create({
          data: {
            recoveryRunId: auditContext.recoveryRunId,
            operationId,
            actorType: auditContext.actorType,
            actorId: auditContext.actorId,
            action: auditContext.action,
            fromStatus: auditContext.fromStatus,
            toStatus: 'CONFIRMED',
            txHash,
            receiptStatus: auditContext.receiptStatus,
            metadata: auditContext.metadata as any,
          },
        });
      }
    }

    return transactions;
  });
}
