import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'prisma/prisma.service';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';
import { TokenService } from 'src/providers/token/token.service';
import { TransactionTypeId } from 'src/constants/transaction-types.enum';
import { AssetType, ParticipantType } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { convertBufferToAddress } from 'src/libs/convertBufferToAddress';
import { getSignerFromSeedPhrase } from 'src/libs/derive-wallet';
import {
  resolveVoucherMerchantId,
  resolveVoucherMerchantName,
} from '../utils/resolve-voucher-merchant.util';

@Injectable()
export class BuyCouponFromMarketplace {
  private readonly logger = new Logger(BuyCouponFromMarketplace.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly blockchainService: BlockchainService,
    private readonly tokenService: TokenService,
    private readonly configService: ConfigService,
  ) {}

  async execute(voucherGroupId: string, pointId: string, phone: string) {
    try {
      this.logger.log(
        `[START] Buying coupon from marketplace. GroupId: ${voucherGroupId}, PointId: ${pointId}, Buyer phone: ${phone}`,
      );

      const customer = await this.findCustomerByPhone(phone);
      const customerId = customer.id;

      const voucherCode = await this.findAvailableVoucherCode(
        voucherGroupId,
        pointId,
      );
      this.validateVoucherCode(voucherCode);

      const customerPoint = await this.validateCustomerBalance(
        customerId,
        voucherCode,
      );

      const { walletAddress, decryptedPrivateKey } =
        await this.prepareCustomerWallet(customer);

      const sellerMerchantId = this.resolveSellerMerchantId(voucherCode);

      const blockchainTx = await this.executePurchaseOnChain(
        voucherCode,
        decryptedPrivateKey,
      );

      const { purchaseTransaction, transferTransaction, merchantWallet } =
        await this.transferOwnership(
          voucherCode,
          customerId,
          customerPoint,
          walletAddress,
          sellerMerchantId,
          blockchainTx,
        );

      await this.updateListingBatchStats(voucherCode.listingBatchId);

      this.logger.log(
        `[SUCCESS] Coupon purchased successfully from marketplace. Payment Transaction ID: ${purchaseTransaction.id}, Transfer Transaction ID: ${transferTransaction.id}`,
      );

      return this.buildResponse(
        voucherCode,
        walletAddress,
        customerId,
        purchaseTransaction,
        transferTransaction,
        merchantWallet,
        blockchainTx,
      );
    } catch (error) {
      this.logger.error(
        `[FATAL ERROR] Failed to buy coupon from marketplace: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /** Find customer by phone number */
  private async findCustomerByPhone(phone: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { tel: phone },
      select: { id: true, walletId: true },
    });

    if (!customer) {
      this.logger.error(`[ERROR] Customer with phone ${phone} not found`);
      throw new NotFoundException(`Customer with phone ${phone} not found`);
    }

    this.logger.log(`[START] Customer found: ${customer.id}`);
    return customer;
  }

  /** Find available voucher code in the given group for the specified point */
  private async findAvailableVoucherCode(
    voucherGroupId: string,
    pointId: string,
  ) {
    this.logger.log(
      `[STEP 1] Finding available voucher code in group: ${voucherGroupId} with pointId: ${pointId}`,
    );

    const voucherCode = await this.prisma.voucherCode.findFirst({
      where: {
        voucherGroupId,
        pointId,
        isUsed: false,
        NOT: { currentOwnerType: 'CUSTOMER' },
      },
      select: {
        id: true,
        code: true,
        voucherId: true,
        voucherGroupId: true,
        listingBatchId: true,
        pointsCost: true,
        pointId: true,
        currency: true,
        isUsed: true,
        currentOwnerId: true,
        currentOwnerType: true,
        point: {
          select: {
            id: true,
            name: true,
            symbol: true,
            contractAddress: true,
            imageUrl: true,
          },
        },
        voucher: {
          select: {
            id: true,
            tokenId: true,
            name: true,
            description: true,
            status: true,
            startDate: true,
            endDate: true,
            valueType: true,
            value: true,
            currency: true,
            merchantId: true,
            sellerMerchantId: true,
            merchantRef: true,
            merchant: {
              select: {
                id: true,
                name: true,
                description: true,
                imageUrl: true,
              },
            },
          },
        },
      },
    });

    if (!voucherCode) {
      this.logger.error(
        `[ERROR] No available voucher in group: ${voucherGroupId} for pointId: ${pointId}`,
      );
      throw new NotFoundException(
        `No available voucher in group ${voucherGroupId} that accepts point ${pointId}`,
      );
    }

    this.logger.log(
      `[STEP 1] Found available code: ${voucherCode.id} in group ${voucherGroupId} for point ${pointId}`,
    );
    return voucherCode;
  }

  /** Validate voucher code state: pointId, isUsed, activation, and date range */
  private validateVoucherCode(
    voucherCode: Awaited<ReturnType<typeof this.findAvailableVoucherCode>>,
  ) {
    if (!voucherCode.pointId) {
      this.logger.error(
        `[ERROR] VoucherCode ${voucherCode.id} has no pointId configured`,
      );
      throw new BadRequestException(
        'This voucher requires point currency setup. Please contact admin.',
      );
    }

    this.logger.log(
      `[STEP 2] Point currency validated: ${voucherCode.currency} (pointId: ${voucherCode.pointId})`,
    );

    if (voucherCode.isUsed) {
      this.logger.error(`[ERROR] Code already used`);
      throw new BadRequestException(`This voucher code has already been used`);
    }

    if (!voucherCode.voucherGroupId) {
      this.logger.error(`[ERROR] Code not yet activated`);
      throw new BadRequestException(
        `This voucher code has not been activated yet`,
      );
    }

    this.validateVoucherDates(voucherCode.voucher);
  }

  /** Validate voucher start/end date range */
  private validateVoucherDates(voucher: { startDate: any; endDate: any }) {
    const now = new Date();
    this.logger.log(`[STEP 5] Checking voucher validity`);

    if (voucher.endDate && new Date(voucher.endDate) < now) {
      this.logger.error(`[ERROR] Voucher expired`);
      throw new BadRequestException(
        `Voucher has expired on ${voucher.endDate}`,
      );
    }

    if (voucher.startDate && new Date(voucher.startDate) > now) {
      this.logger.error(`[ERROR] Voucher not yet valid`);
      throw new BadRequestException(
        `Voucher is not yet valid. Available from ${voucher.startDate}`,
      );
    }
  }

  /** Validate customer has sufficient point balance */
  private async validateCustomerBalance(
    customerId: string,
    voucherCode: { pointId: string; pointsCost: number; currency: string },
  ) {
    this.logger.log(
      `[STEP 6] Checking customer point balance for ${voucherCode.currency}`,
    );

    const customerPoint = await this.prisma.customerPoint.findFirst({
      where: { customerId, pointId: voucherCode.pointId },
    });

    if (!customerPoint) {
      this.logger.error(
        `[ERROR] Customer ${customerId} has no ${voucherCode.currency} points`,
      );
      throw new BadRequestException(
        `You don't have any ${voucherCode.currency} points. Please earn points first.`,
      );
    }

    if (customerPoint.balances < voucherCode.pointsCost) {
      this.logger.error(
        `[ERROR] Insufficient balance. Required: ${voucherCode.pointsCost}, Available: ${customerPoint.balances}`,
      );
      throw new BadRequestException(
        `Insufficient ${voucherCode.currency} balance. Required: ${voucherCode.pointsCost}, Available: ${customerPoint.balances}`,
      );
    }

    this.logger.log(
      `[STEP 6] Balance check passed. Available: ${customerPoint.balances} ${voucherCode.currency}`,
    );
    return customerPoint;
  }

  /** Get customer wallet, decrypt seed phrase, derive private key, and ensure whitelisted */
  private async prepareCustomerWallet(customer: {
    id: string;
    walletId: string;
  }) {
    const customerWallet = await this.prisma.wallet.findUnique({
      where: { id: customer.walletId },
    });

    if (!customerWallet?.walletAddress || !customerWallet?.seedPhrase) {
      throw new BadRequestException('Customer wallet not configured');
    }

    const walletAddress = customerWallet.walletAddress;

    this.logger.log(
      `[STEP 7.5] Decrypting customer seed phrase and deriving private key`,
    );
    const salt = this.configService.get<string>('SALT');
    const decryptedSeedPhrase = this.tokenService.decryptKey(
      salt,
      customerWallet.seedPhrase,
    );

    if (!decryptedSeedPhrase) {
      throw new Error('Failed to decrypt customer seed phrase');
    }

    const customerSigner = getSignerFromSeedPhrase(
      decryptedSeedPhrase,
      customerWallet.derivationIndex || 0,
    );

    await this.ensureWhitelisted(walletAddress);

    return {
      walletAddress,
      decryptedPrivateKey: customerSigner.privateKey,
    };
  }

  /** Ensure customer wallet is whitelisted on the marketplace */
  private async ensureWhitelisted(walletAddress: string) {
    this.logger.log(
      `[STEP 7.6] Checking if customer is whitelisted for marketplace`,
    );
    const isWhitelisted =
      await this.blockchainService.isWhitelisted(walletAddress);

    if (!isWhitelisted) {
      this.logger.log(
        `[STEP 7.6] Customer not whitelisted. Adding to whitelist...`,
      );
      await this.blockchainService.addToMarketplaceWhitelist(walletAddress);
      this.logger.log(`[STEP 7.6] Customer whitelisted successfully ✓`);
    } else {
      this.logger.log(`[STEP 7.6] Customer already whitelisted ✓`);
    }
  }

  /** Determine seller merchant ID from voucher code ownership */
  private resolveSellerMerchantId(voucherCode: {
    currentOwnerType: string;
    currentOwnerId: string;
    voucher: { merchantId?: string | null; sellerMerchantId?: string | null };
  }): string {
    const sellerMerchantId =
      voucherCode.currentOwnerType === 'MERCHANT' && voucherCode.currentOwnerId
        ? voucherCode.currentOwnerId
        : resolveVoucherMerchantId(voucherCode.voucher);

    if (!sellerMerchantId) {
      throw new BadRequestException('Cannot determine voucher owner');
    }

    return sellerMerchantId;
  }

  /** Validate marketplace listing and execute on-chain purchase */
  private async executePurchaseOnChain(
    voucherCode: {
      voucherGroupId: string;
      point: { contractAddress: any } | null;
    },
    decryptedPrivateKey: string,
  ) {
    this.logger.log(`[STEP 8] Calling smart contract buyCoupon on marketplace`);

    this.validateListingId(voucherCode.voucherGroupId);

    const listingId = voucherCode.voucherGroupId;
    const listing =
      await this.blockchainService.getMarketplaceListing(listingId);

    if (!listing.isActive) {
      throw new BadRequestException(
        `Listing ${listingId} is not active. This listing may have been sold out or cancelled.`,
      );
    }

    this.logger.log(`[STEP 8] Listing ${listingId} is active ✓`);
    this.validatePaymentToken(voucherCode.point, listing);

    const blockchainTx = await this.blockchainService.buyCoupon(
      listingId,
      1,
      decryptedPrivateKey,
    );

    this.logger.log(
      `[STEP 8] Marketplace purchase successful. Tx: ${blockchainTx.hash}`,
    );
    return blockchainTx;
  }

  /** Validate that voucherGroupId is a valid numeric listing ID */
  private validateListingId(voucherGroupId: string) {
    if (!voucherGroupId) {
      throw new BadRequestException(
        'Voucher is not listed on marketplace (missing listingId)',
      );
    }

    if (!/^\d+$/.test(voucherGroupId)) {
      throw new BadRequestException(
        'This voucher code uses an old system format and cannot be purchased from marketplace. ' +
          'Please contact the merchant to re-activate this voucher. ' +
          `Current voucherGroupId: ${voucherGroupId}`,
      );
    }
  }

  /** Validate that listing payment token matches the point contract address */
  private validatePaymentToken(
    point: { contractAddress: any } | null,
    listing: { paymentToken: string },
  ) {
    if (!point?.contractAddress) return;

    const expectedPointAddress = convertBufferToAddress(
      point.contractAddress as any,
    ).toLowerCase();

    if (listing.paymentToken.toLowerCase() !== expectedPointAddress) {
      throw new BadRequestException(
        `Listing payment token mismatch. Expected point token: ${expectedPointAddress}, got: ${listing.paymentToken}`,
      );
    }
  }

  /** Transfer voucher ownership and record transactions in the database */
  private async transferOwnership(
    voucherCode: any,
    customerId: string,
    customerPoint: { id: string },
    walletAddress: string,
    sellerMerchantId: string,
    blockchainTx: { hash: string },
  ) {
    this.logger.log(`[STEP 9] Updating database - transferring ownership`);

    const merchantWallet = await this.prisma.wallet.findFirst({
      where: { merchant: { id: sellerMerchantId } },
      select: { walletAddress: true },
    });

    if (!merchantWallet?.walletAddress) {
      throw new BadRequestException('Merchant wallet not found');
    }

    const txHashBuffer = Buffer.from(blockchainTx.hash.slice(2), 'hex');
    const customerAddressBuffer = Buffer.from(walletAddress.slice(2), 'hex');
    const merchantAddressBuffer = Buffer.from(
      merchantWallet.walletAddress.slice(2),
      'hex',
    );

    const transactionRefId = randomUUID();
    const voucherMerchantId = resolveVoucherMerchantId(voucherCode.voucher);

    const [, , purchaseTransaction, transferTransaction] =
      await this.prisma.$transaction([
        this.prisma.voucherCode.update({
          where: { id: voucherCode.id },
          data: {
            currentOwnerId: customerId,
            currentOwnerType: 'CUSTOMER',
          },
        }),

        this.prisma.customerPoint.update({
          where: { id: customerPoint.id },
          data: {
            balances: { decrement: voucherCode.pointsCost },
          },
        }),

        this.prisma.transaction.create({
          data: {
            txHash: txHashBuffer,
            senderAddress: customerAddressBuffer,
            receiverAddress: merchantAddressBuffer,
            amount: voucherCode.pointsCost,
            pointId: voucherCode.pointId,
            merchantId: voucherMerchantId,
            merchantRef: voucherCode.voucher.merchantRef || null,
            senderId: customerId,
            receiverId: voucherMerchantId,
            voucherCodeId: voucherCode.id,
            transactionTypeId: TransactionTypeId.TRANSFER,
            type: AssetType.POINT,
            senderType: ParticipantType.CUSTOMER,
            receiverType: ParticipantType.MERCHANT,
            transactionRefId,
          } as any,
        }),

        this.prisma.transaction.create({
          data: {
            txHash: txHashBuffer,
            senderAddress: merchantAddressBuffer,
            receiverAddress: customerAddressBuffer,
            amount: 1,
            pointId: voucherCode.pointId,
            merchantId: voucherMerchantId,
            merchantRef: voucherCode.voucher.merchantRef || null,
            senderId: voucherMerchantId,
            receiverId: customerId,
            voucherCodeId: voucherCode.id,
            transactionTypeId: TransactionTypeId.TRANSFER,
            type: AssetType.VOUCHER,
            senderType: ParticipantType.MERCHANT,
            receiverType: ParticipantType.CUSTOMER,
            transactionRefId,
          } as any,
        }),
      ]);

    return { purchaseTransaction, transferTransaction, merchantWallet };
  }

  /** Update listing batch sold count and mark as SOLD_OUT if fully sold */
  private async updateListingBatchStats(listingBatchId: string | null) {
    if (!listingBatchId) return;

    await this.prisma.listingBatch.update({
      where: { id: listingBatchId },
      data: { soldItems: { increment: 1 } },
    });

    const batch = await this.prisma.listingBatch.findUnique({
      where: { id: listingBatchId },
      select: { totalItems: true, soldItems: true },
    });

    if (batch && batch.soldItems >= batch.totalItems) {
      await this.prisma.listingBatch.update({
        where: { id: listingBatchId },
        data: { status: 'SOLD_OUT' },
      });
      this.logger.log(`[INFO] ListingBatch ${listingBatchId} is now SOLD_OUT`);
    }
  }

  /** Build the final purchase response */
  private buildResponse(
    voucherCode: any,
    walletAddress: string,
    customerId: string,
    purchaseTransaction: any,
    transferTransaction: any,
    merchantWallet: { walletAddress: string },
    blockchainTx: { hash: string; blockNumber: number },
  ) {
    const voucher = voucherCode.voucher;
    return {
      success: true,
      message: 'Voucher purchased successfully from marketplace',
      purchase: {
        voucherCodeId: voucherCode.id,
        code: voucherCode.code,
        address: walletAddress,
        customerId,
        purchasePrice: voucherCode.pointsCost,
        transactionId: purchaseTransaction.id,
        purchasedAt: purchaseTransaction.createdAt,
      },
      transactions: {
        payment: {
          id: purchaseTransaction.id,
          type: TransactionTypeId.TRANSFER,
          assetType: 'POINT',
          amount: voucherCode.pointsCost,
          from: walletAddress,
          to: merchantWallet.walletAddress,
          createdAt: purchaseTransaction.createdAt,
        },
        transfer: {
          id: transferTransaction.id,
          type: TransactionTypeId.TRANSFER,
          assetType: 'VOUCHER',
          amount: 1,
          from: merchantWallet.walletAddress,
          to: walletAddress,
          createdAt: transferTransaction.createdAt,
        },
      },
      voucher: {
        id: voucher.id,
        name: voucher.name,
        description: voucher.description,
        valueType: voucher.valueType,
        value: voucher.value,
        merchantRef: voucher.merchantRef || null,
        merchantName: resolveVoucherMerchantName(voucher) || '',
        startDate: voucher.startDate,
        endDate: voucher.endDate,
      },
      blockchain: {
        transactionHash: blockchainTx.hash,
        blockNumber: blockchainTx.blockNumber,
      },
    };
  }
}
