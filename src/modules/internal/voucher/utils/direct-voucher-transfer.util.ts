import { randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';
import {
  AssetType,
  TransactionTypeId,
} from 'src/constants/transaction-types.enum';
import { getSignerFromSeedPhrase } from 'src/libs/derive-wallet';
import { PrismaService } from 'prisma/prisma.service';
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

export interface WriteDirectVoucherTransferLedgerParams {
  prisma: any;
  voucherCodeIds: string[];
  merchant: MerchantLike;
  customer: CustomerLike;
  voucher: VoucherLike;
  txHash: string;
  transactionRefId?: string;
}

export interface LockAvailableMerchantVoucherCodesParams {
  voucherId: string;
  merchantId: string;
  quantity: number;
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
    LIMIT $3
    FOR UPDATE SKIP LOCKED
  `,
    voucherId,
    merchantId,
    quantity,
  );
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
}: WriteDirectVoucherTransferLedgerParams): Promise<any[]> {
  const txHashBuffer = txHashToBuffer(txHash);
  const senderAddressBuffer = hexAddressToBuffer(merchant.wallet.walletAddress);
  const receiverAddressBuffer = hexAddressToBuffer(
    customer.wallet.walletAddress,
  );

  return prisma.$transaction(async (tx) => {
    await tx.voucherCode.updateMany({
      where: { id: { in: voucherCodeIds } },
      data: {
        currentOwnerId: customer.id,
        currentOwnerType: 'CUSTOMER',
        voucherGroupId: null,
      },
    });

    return Promise.all(
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
            transactionRefId: transactionRefId || randomUUID(),
          },
        }),
      ),
    );
  });
}
