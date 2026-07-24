import {
  Injectable,
  Logger,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';
import { TokenService } from 'src/providers/token/token.service';
import { ConfigService } from '@nestjs/config';
import {
  getMerchantPrivateKey,
  insufficientWalletPoolError,
  lockAvailableMerchantVoucherCodes,
  writeDirectVoucherTransferLedger,
} from '../utils/direct-voucher-transfer.util';

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

      if (!merchant?.wallet?.seedPhrase) {
        throw new NotFoundException(
          'Merchant or Merchant Wallet seed phrase not found',
        );
      }

      // 2. Get Customer Info
      const customer = await this.prisma.customer.findUnique({
        where: { tel: customerPhone },
        include: { wallet: true },
      });

      if (!customer?.wallet) {
        throw new NotFoundException('Customer or Customer Wallet not found');
      }

      // 3. Find available VoucherCode for this Merchant
      // The merchant must own the code (currentOwnerId = merchantId)
      const availableCodes = await lockAvailableMerchantVoucherCodes(
        this.prisma,
        {
          voucherId,
          merchantId,
          quantity,
        },
      );

      if (!availableCodes || availableCodes.length < quantity) {
        throw insufficientWalletPoolError({
          voucherId,
          requested: quantity,
          available: availableCodes?.length || 0,
        });
      }

      const voucherCodeIds = availableCodes.map((c) => c.id);

      // 4. Get Voucher Meta (for typeId)
      const voucher = await this.prisma.voucher.findUnique({
        where: { id: voucherId },
      });

      if (!voucher?.tokenId) {
        throw new NotFoundException('Voucher or Token ID not found');
      }

      const typeId = Number.parseInt(voucher.tokenId, 10);

      // Decrypt merchant key
      const merchantPrivateKey = getMerchantPrivateKey(
        this.configService,
        this.tokenService,
        merchant,
      );

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

      // 6. Update DB State (assign owner & record transaction)
      const result = await writeDirectVoucherTransferLedger({
        prisma: this.prisma,
        voucherCodeIds,
        merchant,
        customer,
        voucher,
        txHash,
      });

      return {
        message: 'Voucher transfer successful',
        transactionHash: txHash,
        transferredQuantity: quantity,
        voucherCodeIds: voucherCodeIds,
        transactionIds: result.map((tx) => tx.id),
        // Design Doc compatibility
        voucherCodeId: voucherCodeIds[0],
        code: availableCodes[0]?.code,
        transactionId: result[0]?.id,
        voucher: voucher,
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
