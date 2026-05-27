import {
  Injectable,
  Logger,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';
import { randomUUID } from 'crypto';
import {
  TransactionTypeId,
  AssetType,
} from 'src/constants/transaction-types.enum';
import { convertBufferToAddress } from 'src/libs/convertBufferToAddress';
import { TokenService } from 'src/providers/token/token.service';
import { ConfigService } from '@nestjs/config';
import { getSignerFromSeedPhrase } from 'src/libs/derive-wallet';

@Injectable()
export class TransferVoucherToCustomerHandler {
  private readonly logger = new Logger(TransferVoucherToCustomerHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly blockchainService: BlockchainService,
    private readonly tokenService: TokenService,
    private readonly configService: ConfigService,
  ) {}

  async execute(dto: {
    merchantId: string;
    customerPhone: string;
    voucherId: string;
    quantity?: number;
  }) {
    const { merchantId, customerPhone, voucherId, quantity = 1 } = dto;

    try {
      // 1. Get Merchant Info & Validate Wallet
      const merchant = await this.prisma.merchant.findUnique({
        where: { id: merchantId },
        include: { wallet: true },
      });

      if (!merchant || !merchant.wallet || !merchant.wallet.seedPhrase) {
        throw new NotFoundException(
          'Merchant or Merchant Wallet seed phrase not found',
        );
      }

      // 2. Get Customer Info
      const customer = await this.prisma.customer.findUnique({
        where: { tel: customerPhone },
        include: { wallet: true },
      });

      if (!customer || !customer.wallet) {
        throw new NotFoundException('Customer or Customer Wallet not found');
      }

      // 3. Find available VoucherCode for this Merchant
      // The merchant must own the code (currentOwnerId = merchantId)
      const availableCodes = await this.prisma.$queryRawUnsafe<any[]>(
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

      if (!availableCodes || availableCodes.length < quantity) {
        throw new BadRequestException(
          `Not enough available voucher stock. Requested ${quantity}, found ${availableCodes?.length || 0}`,
        );
      }

      const voucherCodeIds = availableCodes.map((c) => c.id);

      // 4. Get Voucher Meta (for typeId)
      const voucher = await this.prisma.voucher.findUnique({
        where: { id: voucherId },
      });

      if (!voucher || !voucher.tokenId) {
        throw new NotFoundException('Voucher or Token ID not found');
      }

      const typeId = parseInt(voucher.tokenId, 10);

      // Decrypt merchant key
      const salt = this.configService.get<string>('SALT');
      const decryptedSeedPhrase = this.tokenService.decryptKey(
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
      const merchantPrivateKey = merchantSigner.privateKey;

      // 5. Transfer via Blockchain
      this.logger.log(
        `Transferring Voucher typeId ${typeId} (qty: ${quantity}) from ${merchant.wallet.walletAddress} to customer ${customer.wallet.walletAddress}`,
      );

      const txHash = await this.blockchainService.transferCoupon(
        typeId,
        quantity,
        merchant.wallet.walletAddress,
        customer.wallet.walletAddress,
        merchantPrivateKey,
      );

      const txHashBuffer = Buffer.from(txHash.replace(/^0x/, ''), 'hex');
      const senderAddressBuffer = Buffer.from(
        merchant.wallet.walletAddress.replace(/^0x/, ''),
        'hex',
      );
      const receiverAddressBuffer = Buffer.from(
        customer.wallet.walletAddress.replace(/^0x/, ''),
        'hex',
      );

      // 6. Update DB State (assign owner & record transaction)
      const result = await this.prisma.$transaction(async (tx) => {
        await tx.voucherCode.updateMany({
          where: { id: { in: voucherCodeIds } },
          data: {
            currentOwnerId: customer.id,
            currentOwnerType: 'CUSTOMER',
          },
        });

        // We can create a transaction record for each code or just one. The existing logic created one per code in similar flows.
        const transactions = await Promise.all(
          voucherCodeIds.map((codeId) =>
            tx.transaction.create({
              data: {
                txHash: txHashBuffer,
                amount: 1, // 1 unit per voucher code row
                senderAddress: senderAddressBuffer,
                receiverAddress: receiverAddressBuffer,
                merchantId: merchant.id,
                voucherCodeId: codeId,
                senderId: merchant.id,
                receiverId: customer.id,
                senderType: 'MERCHANT',
                receiverType: 'CUSTOMER',
                transactionTypeId: TransactionTypeId.TRANSFER,
                type: AssetType.VOUCHER,
                transactionRefId: randomUUID(),
              },
            }),
          ),
        );

        return transactions;
      });

      return {
        message: 'Voucher transfer successful',
        transactionHash: txHash,
        transferredQuantity: quantity,
        voucherCodeIds: voucherCodeIds,
        transactionIds: result.map((tx) => tx.id),
      };
    } catch (error) {
      this.logger.error(
        `Error transferring voucher: ${error.message}`,
        error.stack,
      );
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to transfer voucher');
    }
  }
}
