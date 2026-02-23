import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';
import { TransactionTypeId } from 'src/constants/transaction-types.enum';
import { AssetType, ParticipantType } from '@prisma/client';
import { randomUUID } from 'crypto';
import { TokenService } from 'src/providers/token/token.service';
import { ConfigService } from '@nestjs/config';
import { getSignerFromSeedPhrase } from 'src/libs/derive-wallet';
import { MerchantRefEnrichmentService } from 'src/modules/shared/services/merchant-ref-enrichment.service';

@Injectable()
export class RedeemVoucher {
  private logger = new Logger(RedeemVoucher.name);
  private salt: string;

  constructor(
    private prisma: PrismaService,
    private blockchainService: BlockchainService,
    private tokenService: TokenService,
    private configService: ConfigService,
    private merchantRefEnrichment: MerchantRefEnrichmentService,
  ) {
    this.salt = this.configService.get<string>('SALT');
  }

  async execute(code: string, phone: string, merchantRef: string) {
    try {
      this.logger.log(
        `[START] Redeeming voucher code: ${code} for customer phone: ${phone} at merchant: ${merchantRef}`,
      );

      // 0. Find customer by phone
      const customer = await this.findCustomerByPhone(phone);
      const customerId = customer.id;

      // 1-6. Validate voucher code
      const voucherCode = await this.validateVoucherCode(
        code,
        customerId,
        merchantRef,
      );
      const voucher = voucherCode.voucher;

      // 7. Get customer wallet credentials
      const { customerAddress, customerPrivateKey } =
        this.getCustomerWalletCredentials(customer);

      // 7.5 Verify on-chain balance
      await this.verifyOnChainBalance(customerAddress, voucher.tokenId);

      // 8. Redeem on blockchain
      const blockchainTx = await this.redeemOnBlockchain(
        code,
        voucher,
        customerAddress,
        customerPrivateKey,
      );

      // 9. Resolve merchant
      const { merchantId, merchant, merchantAddress } =
        await this.resolveMerchantForRedemption(voucher, voucherCode);

      // 10. Update database
      const [updatedCode, redeemTransaction] = await this.prisma.$transaction([
        this.prisma.voucherCode.update({
          where: { id: voucherCode.id },
          data: { isUsed: true, usedBy: customerId, usedAt: new Date() },
          include: { voucher: true },
        }),
        this.prisma.transaction.create({
          data: {
            txHash: Buffer.from(blockchainTx.hash.slice(2), 'hex'),
            senderAddress: Buffer.from(customerAddress.slice(2), 'hex'),
            receiverAddress: Buffer.from(merchantAddress.slice(2), 'hex'),
            amount: 1,
            pointId: voucherCode.pointId,
            senderId: customerId,
            receiverId: merchantId,
            merchantId,
            merchantRef: voucher.merchantRef || null,
            voucherCodeId: voucherCode.id,
            transactionTypeId: TransactionTypeId.REDEEM,
            type: AssetType.VOUCHER,
            senderType: ParticipantType.CUSTOMER,
            receiverType: ParticipantType.MERCHANT,
            transactionRefId: randomUUID(),
          },
        }),
      ]);

      this.logger.log(
        `[STEP 10] REDEEM transaction created. TxId: ${redeemTransaction.id}`,
      );
      this.logger.log(
        `[SUCCESS] Voucher code redeemed successfully for customer: ${customerId}`,
      );

      // 11. Build and return response
      return this.buildRedeemResponse({
        voucher,
        voucherCode,
        merchant,
        merchantId,
        merchantAddress,
        customer,
        customerId,
        customerAddress,
        blockchainTx,
        updatedCode,
        redeemTransaction,
      });
    } catch (error) {
      this.logger.error(
        `[FATAL ERROR] Failed to redeem voucher: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /** Find customer by phone number */
  private async findCustomerByPhone(phone: string) {
    this.logger.log(`[STEP 0] Finding customer by phone: ${phone}`);
    const customer = await this.prisma.customer.findFirst({
      where: { tel: phone },
      include: { wallet: true },
    });

    if (!customer) {
      this.logger.error(`[ERROR] Customer with phone ${phone} not found`);
      throw new NotFoundException(`Customer with phone ${phone} not found`);
    }

    this.logger.log(`[STEP 0] Customer found: ${customer.id}`);
    return customer;
  }

  /** Validate voucher code: existence, usage, merchantRef, expiry, pointId, activation, ownership */
  private async validateVoucherCode(
    code: string,
    customerId: string,
    merchantRef: string,
  ) {
    this.logger.log(`[STEP 1] Validating voucher code: ${code}`);
    const voucherCode = await this.prisma.voucherCode.findUnique({
      where: { code },
      select: {
        id: true,
        code: true,
        voucherId: true,
        voucherGroupId: true,
        pointsCost: true,
        pointId: true,
        currency: true,
        isUsed: true,
        usedBy: true,
        usedAt: true,
        currentOwnerId: true,
        currentOwnerType: true,
        voucher: {
          select: {
            id: true,
            tokenId: true,
            name: true,
            description: true,
            imageUrl: true,
            status: true,
            startDate: true,
            endDate: true,
            valueType: true,
            value: true,
            currency: true,
            totalRedeemed: true,
            merchantId: true,
            merchantName: true,
            merchant: {
              select: {
                id: true,
                name: true,
                description: true,
                imageUrl: true,
              },
            },
            merchantRef: true,
          },
        },
      },
    });

    if (!voucherCode) {
      this.logger.error(`[ERROR] Voucher code not found: ${code}`);
      throw new NotFoundException(`Voucher code "${code}" not found`);
    }

    this.assertCodeNotUsed(voucherCode);
    this.assertMerchantRefMatch(voucherCode, merchantRef);
    this.assertVoucherNotExpired(voucherCode.voucher);
    this.assertPointIdConfigured(voucherCode, code);
    this.assertCodeActivated(voucherCode);
    this.assertOwnership(voucherCode, customerId);

    return voucherCode;
  }

  private assertCodeNotUsed(voucherCode: any) {
    if (!voucherCode.isUsed) return;
    this.logger.error(
      `[ERROR] Code already redeemed by: ${voucherCode.usedBy} at ${voucherCode.usedAt}`,
    );
    const suffix = voucherCode.usedBy
      ? ` by customer: ${voucherCode.usedBy}`
      : '';
    throw new BadRequestException(
      `Voucher code has already been redeemed${suffix}`,
    );
  }

  private assertMerchantRefMatch(voucherCode: any, merchantRef: string) {
    this.logger.log(`[STEP 2.5] Verifying merchantRef: ${merchantRef}`);
    if (
      voucherCode.voucher.merchantRef &&
      voucherCode.voucher.merchantRef !== merchantRef
    ) {
      this.logger.error(
        `[ERROR] MerchantRef mismatch. Expected: ${voucherCode.voucher.merchantRef}, Got: ${merchantRef}`,
      );
      throw new BadRequestException(
        `This voucher can only be redeemed at the issuing merchant`,
      );
    }
    this.logger.log(`[STEP 2.5] MerchantRef verified ✓`);
  }

  private assertVoucherNotExpired(voucher: any) {
    this.logger.log(`[STEP 3] Checking voucher validity`);
    const now = new Date();

    if (voucher.endDate && new Date(voucher.endDate) < now) {
      this.logger.error(`[ERROR] Voucher expired at: ${voucher.endDate}`);
      throw new BadRequestException(
        `Voucher has expired on ${voucher.endDate}`,
      );
    }

    if (voucher.startDate && new Date(voucher.startDate) > now) {
      this.logger.error(
        `[ERROR] Voucher not yet valid. Start date: ${voucher.startDate}`,
      );
      throw new BadRequestException(
        `Voucher is not yet valid. Available from ${voucher.startDate}`,
      );
    }
  }

  private assertPointIdConfigured(voucherCode: any, code: string) {
    if (!voucherCode.pointId) {
      this.logger.error(
        `[ERROR] VoucherCode ${code} has no pointId configured`,
      );
      throw new BadRequestException(
        'This voucher requires point currency setup. Please contact admin.',
      );
    }
    this.logger.log(
      `[STEP 4] Point currency: ${voucherCode.currency} (pointId: ${voucherCode.pointId})`,
    );
  }

  private assertCodeActivated(voucherCode: any) {
    if (!voucherCode.voucherGroupId) {
      this.logger.error(`[ERROR] Code not yet activated (no voucherGroupId)`);
      throw new BadRequestException(`Voucher code has not been activated yet`);
    }
  }

  private assertOwnership(voucherCode: any, customerId: string) {
    if (
      voucherCode.currentOwnerId &&
      voucherCode.currentOwnerType === 'CUSTOMER' &&
      voucherCode.currentOwnerId !== customerId
    ) {
      this.logger.error(
        `[ERROR] Customer ${customerId} does not own this voucher. Owner: ${voucherCode.currentOwnerId}`,
      );
      throw new BadRequestException(
        `You do not own this voucher. It belongs to another customer.`,
      );
    }
  }

  /** Get customer wallet address and private key */
  private getCustomerWalletCredentials(customer: any) {
    this.logger.log(`[STEP 7] Getting customer wallet address`);
    const customerAddress = customer.wallet?.walletAddress || '';
    const encryptedSeedPhrase = customer.wallet?.seedPhrase || '';
    const decryptedSeedPhrase = this.tokenService.decryptKey(
      this.salt,
      encryptedSeedPhrase,
    );

    if (!customerAddress) {
      throw new NotFoundException('Customer wallet not configured');
    }
    if (!decryptedSeedPhrase) {
      throw new NotFoundException(
        'Customer seed phrase not configured or decryption failed',
      );
    }

    const customerSigner = getSignerFromSeedPhrase(
      decryptedSeedPhrase,
      customer.wallet?.derivationIndex || 0,
    );

    return {
      customerAddress,
      customerPrivateKey: customerSigner.privateKey,
    };
  }

  /** Verify on-chain coupon balance before redeem */
  private async verifyOnChainBalance(
    customerAddress: string,
    tokenId: string | null,
  ) {
    this.logger.log(
      `[STEP 7.5] Checking on-chain coupon balance for typeId: ${tokenId} and owner: ${customerAddress}`,
    );
    const onChainBalance = await this.blockchainService.getUserCouponBalance(
      customerAddress,
      Number(tokenId),
    );

    if (!onChainBalance || Number(onChainBalance.balance) < 1) {
      this.logger.error(
        `[ERROR] On-chain balance insufficient. Balance: ${onChainBalance?.balance || 0}`,
      );
      throw new BadRequestException(
        'Insufficient on-chain coupon balance for redemption',
      );
    }
  }

  /** Redeem voucher on blockchain (burn ERC-1155) */
  private async redeemOnBlockchain(
    code: string,
    voucher: any,
    customerAddress: string,
    customerPrivateKey: string,
  ) {
    this.logger.log(
      `[STEP 8] Calling smart contract to redeem voucher code: ${code}`,
    );

    if (!voucher.tokenId) {
      throw new BadRequestException(
        'Voucher does not have tokenId. Cannot redeem on blockchain.',
      );
    }

    try {
      const blockchainTx = await this.blockchainService.redeemVoucher(
        voucher.tokenId,
        1,
        customerAddress,
        customerPrivateKey,
      );

      this.logger.log(
        `[STEP 8] Smart contract redeem successful. Tx: ${blockchainTx.hash}`,
      );
      return blockchainTx;
    } catch (error) {
      this.logger.error(
        `[ERROR] Smart contract redeem failed: ${error.message}`,
      );
      throw new BadRequestException(
        `Failed to redeem voucher on blockchain: ${error.message}`,
      );
    }
  }

  /** Resolve merchant ID and wallet for the redemption */
  private async resolveMerchantForRedemption(voucher: any, voucherCode: any) {
    this.logger.log(`[STEP 9] Getting merchant wallet address`);

    let merchantId = voucher.merchantId;

    if (!merchantId && voucherCode.pointId) {
      this.logger.log(
        `[STEP 9] Voucher has no merchantId (seller voucher), looking up from Point: ${voucherCode.pointId}`,
      );
      const point = await this.prisma.point.findUnique({
        where: { id: voucherCode.pointId },
        select: { merchantId: true },
      });
      if (point?.merchantId) {
        merchantId = point.merchantId;
        this.logger.log(`[STEP 9] Found merchant from Point: ${merchantId}`);
      }
    }

    if (!merchantId) {
      throw new BadRequestException(
        'Cannot determine merchant for redemption. Voucher code may not be properly activated.',
      );
    }

    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
      select: {
        walletId: true,
        wallet: true,
        name: true,
        imageUrl: true,
        website: true,
      },
    });

    if (!merchant?.wallet) {
      throw new BadRequestException(
        'Merchant wallet not configured. Cannot process redemption.',
      );
    }

    return {
      merchantId,
      merchant,
      merchantAddress: merchant.wallet.walletAddress || '',
    };
  }

  /** Build the full redeem response */
  private async buildRedeemResponse(params: {
    voucher: any;
    voucherCode: any;
    merchant: any;
    merchantId: string;
    merchantAddress: string;
    customer: any;
    customerId: string;
    customerAddress: string;
    blockchainTx: any;
    updatedCode: any;
    redeemTransaction: any;
  }) {
    const {
      voucher,
      voucherCode,
      merchant,
      merchantId,
      merchantAddress,
      customer,
      customerId,
      customerAddress,
      blockchainTx,
      updatedCode,
      redeemTransaction,
    } = params;

    const merchantRefDetail = voucher.merchantRef
      ? await this.merchantRefEnrichment.enrich(voucher.merchantRef)
      : null;

    const transactionResponse = {
      id: redeemTransaction.id,
      txHash: blockchainTx.hash,
      senderAddress: customerAddress,
      receiverAddress: merchantAddress,
      transactionTypeId: redeemTransaction.transactionTypeId,
      amount: redeemTransaction.amount,
      transactionDirection: 'SENT' as 'SENT' | 'RECEIVED',
      senderId: customerId,
      receiverId: merchantId,
      senderType: 'CUSTOMER',
      receiverType: 'MERCHANT',
      merchant: {
        id: merchantId,
        name:
          voucher.merchant?.name ||
          voucher.merchantName ||
          merchant?.name ||
          '',
        imageUrl: merchant?.imageUrl || null,
      },
      point: voucherCode.pointId
        ? {
            id: voucherCode.pointId,
            name: voucherCode.currency || 'POINT',
            symbol: voucherCode.currency || 'POINT',
            merchantId: merchantId,
            imageUrl: null,
            balance: redeemTransaction.amount,
          }
        : null,
      sender: {
        id: customerId,
        walletAddress: customerAddress,
        displayName: customer.tel,
      },
      receiver: {
        id: merchantId,
        walletAddress: merchantAddress,
        displayName: merchant?.name || '',
      },
      voucher: {
        id: voucher.id,
        tokenId: voucher.tokenId || null,
        name: voucher.name,
        description: voucher.description || null,
        valueType: voucher.valueType,
        value: voucher.value,
        currency: voucher.currency || voucherCode.currency || null,
        imageUrl: voucher.imageUrl || null,
        startDate: voucher.startDate || null,
        endDate: voucher.endDate || null,
        merchantRefDetail,
      },
      eventId: null,
      transactionRefId: redeemTransaction.transactionRefId || null,
      typeAsset: 'VOUCHER',
      createdAt: redeemTransaction.createdAt,
    };

    return {
      success: true,
      message: 'Voucher redeemed successfully',
      voucher: {
        id: voucher.id,
        name: voucher.name,
        description: voucher.description,
        imageUrl: voucher.imageUrl || null,
        valueType: voucher.valueType,
        value: voucher.value,
        merchantName: voucher.merchant?.name || voucher.merchantName,
        merchantRefDetail,
        startDate: voucher.startDate,
        endDate: voucher.endDate,
      },
      redemption: {
        code: updatedCode.code,
        redeemedBy: updatedCode.usedBy,
        redeemedAt: updatedCode.usedAt,
        pointsCost: updatedCode.pointsCost,
      },
      transaction: transactionResponse,
      blockchain: {
        transactionHash: blockchainTx.hash,
        blockNumber: blockchainTx.blockNumber,
      },
      vaultRelease: null,
    };
  }

  /**
   * ตรวจสอบสถานะของ code ก่อน redeem
   */
  async validateCode(code: string) {
    try {
      this.logger.log(`[VALIDATE] Checking voucher code: ${code}`);

      const voucherCode = await this.prisma.voucherCode.findUnique({
        where: { code },
        include: {
          voucher: {
            include: {
              merchant: true,
            },
          },
        },
      });

      if (!voucherCode) {
        return {
          valid: false,
          reason: 'Code not found',
        };
      }

      if (voucherCode.isUsed) {
        return {
          valid: false,
          reason: 'Code already redeemed',
          usedBy: voucherCode.usedBy,
          usedAt: voucherCode.usedAt,
        };
      }

      const now = new Date();
      const voucher = voucherCode.voucher;

      if (voucher.endDate && new Date(voucher.endDate) < now) {
        return {
          valid: false,
          reason: 'Voucher expired',
          endDate: voucher.endDate,
        };
      }

      if (voucher.startDate && new Date(voucher.startDate) > now) {
        return {
          valid: false,
          reason: 'Voucher not yet valid',
          startDate: voucher.startDate,
        };
      }

      // Enrich merchantRef for validate response
      const merchantRefDetail = voucher.merchantRef
        ? await this.merchantRefEnrichment.enrich(voucher.merchantRef)
        : null;

      return {
        valid: true,
        voucher: {
          id: voucher.id,
          name: voucher.name,
          description: voucher.description,
          valueType: voucher.valueType,
          value: voucher.value,
          merchantName: voucher.merchant?.name || voucher.merchantName,
          merchantRefDetail,
          startDate: voucher.startDate,
          endDate: voucher.endDate,
        },
        pointsCost: voucherCode.pointsCost,
      };
    } catch (error) {
      this.logger.error(`[ERROR] Failed to validate code: ${error.message}`);
      throw error;
    }
  }

  /**
   * Redeem AIS voucher - similar to execute but transfers points to receiverPhone
   */
  async executeAIS(
    code: string,
    phone: string,
    merchantRef: string,
    receiverPhone: string,
  ) {
    try {
      this.logger.log(
        `[START AIS] Redeeming AIS voucher code: ${code} for customer phone: ${phone}, receiver: ${receiverPhone} at merchant: ${merchantRef}`,
      );

      // 0. Find redeemer customer by phone
      this.logger.log(`[STEP 0] Finding redeemer customer by phone: ${phone}`);
      const customer = await this.prisma.customer.findFirst({
        where: { tel: phone },
        include: { wallet: true },
      });

      if (!customer) {
        this.logger.error(`[ERROR] Customer with phone ${phone} not found`);
        throw new NotFoundException(`Customer with phone ${phone} not found`);
      }

      // 0b. Find receiver customer by receiverPhone
      this.logger.log(
        `[STEP 0b] Finding receiver customer by phone: ${receiverPhone}`,
      );
      const receiverCustomer = await this.prisma.customer.findFirst({
        where: { tel: receiverPhone },
        include: { wallet: true },
      });

      if (!receiverCustomer) {
        this.logger.error(
          `[ERROR] Receiver customer with phone ${receiverPhone} not found`,
        );
        throw new NotFoundException(
          `Receiver customer with phone ${receiverPhone} not found`,
        );
      }

      const customerId = customer.id;
      const receiverCustomerId = receiverCustomer.id;

      this.logger.log(
        `[STEP 0] Redeemer: ${customerId}, Receiver: ${receiverCustomerId}`,
      );

      // 1. First validate that this is an AIS voucher
      this.logger.log(`[STEP 1] Validating voucher type`);
      const voucherCode = await this.prisma.voucherCode.findUnique({
        where: { code },
        select: {
          voucher: {
            select: {
              valueType: true,
              value: true,
            },
          },
        },
      });

      if (voucherCode?.voucher.valueType !== 'aispoint') {
        throw new BadRequestException(
          'This endpoint is only for AIS Point vouchers. Use /coupon/redeem for other voucher types.',
        );
      }

      this.logger.log(
        `[STEP 1] Voucher type validated: aispoint (value: ${voucherCode.voucher.value})`,
      );

      // Call the normal redeem flow
      const redeemResult = await this.execute(code, phone, merchantRef);

      // Additional: Transfer points to receiver (AIS-specific logic)
      // TODO: Call AIS API to transfer points
      // Amount to transfer = voucher.value (the AIS point amount)
      const transferAmount = voucherCode.voucher.value;

      this.logger.log(
        `[SUCCESS AIS] Voucher redeemed. Points (${transferAmount}) prepared for transfer to ${receiverPhone}`,
      );

      return {
        ...redeemResult,
        pointTransfer: {
          phone: phone,
          receiverPhone: receiverPhone,
          amount: transferAmount,
        },
      };
    } catch (error) {
      this.logger.error(
        `[ERROR AIS] Failed to redeem AIS voucher: ${error.message}`,
      );
      throw error;
    }
  }
}
