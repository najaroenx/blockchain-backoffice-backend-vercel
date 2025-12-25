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
import { AssetType } from '@prisma/client';
import { randomUUID } from 'crypto';
import { convertBufferToAddress } from 'src/libs/convertBufferToAddress';

@Injectable()
export class BuyCouponFromMarketplace {
  private logger = new Logger(BuyCouponFromMarketplace.name);

  constructor(
    private prisma: PrismaService,
    private blockchainService: BlockchainService,
    private tokenService: TokenService,
    private configService: ConfigService,
  ) {}

  async execute(voucherGroupId: string, pointId: string, phone: string) {
    try {
      this.logger.log(
        `[START] Buying coupon from marketplace. GroupId: ${voucherGroupId}, PointId: ${pointId}, Buyer phone: ${phone}`,
      );

      // Find customer by phone (tel field)
      const customer = await this.prisma.customer.findFirst({
        where: { tel: phone },
        select: {
          id: true,
          walletId: true,
        },
      });

      if (!customer) {
        this.logger.error(`[ERROR] Customer with phone ${phone} not found`);
        throw new NotFoundException(`Customer with phone ${phone} not found`);
      }

      const customerId = customer.id;
      this.logger.log(`[START] Customer found: ${customerId}`);

      // 1. หา available voucher code จาก group และ validate point
      this.logger.log(
        `[STEP 1] Finding available voucher code in group: ${voucherGroupId} with pointId: ${pointId}`,
      );
      const voucherCode = await this.prisma.voucherCode.findFirst({
        where: {
          voucherGroupId,
          pointId, // ต้อง match กับ point ที่เลือกจ่าย
          isUsed: false,
          currentOwnerId: null,
        },
        select: {
          id: true,
          code: true,
          voucherId: true,
          voucherGroupId: true,
          listingBatchId: true, // Include batch reference for updating stats
          pointsCost: true,
          pointId: true,
          currency: true,
          isUsed: true,
          currentOwnerId: true,
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

      const voucherCodeId = voucherCode.id;
      this.logger.log(
        `[STEP 1] Found available code: ${voucherCodeId} in group ${voucherGroupId} for point ${pointId}`,
      );

      // 2. Backward Compatibility: ตรวจสอบ pointId
      this.logger.log(`[STEP 2] Checking pointId setup`);
      if (!voucherCode.pointId) {
        this.logger.error(
          `[ERROR] VoucherCode ${voucherCodeId} has no pointId configured`,
        );
        throw new BadRequestException(
          'This voucher requires point currency setup. Please contact admin.',
        );
      }

      this.logger.log(
        `[STEP 2] Point currency validated: ${voucherCode.currency} (pointId: ${voucherCode.pointId})`,
      );

      // 3. ตรวจสอบว่า code ยังไม่ถูกใช้
      this.logger.log(`[STEP 3] Checking if code is available`);
      if (voucherCode.isUsed) {
        this.logger.error(`[ERROR] Code already used`);
        throw new BadRequestException(
          `This voucher code has already been used`,
        );
      }

      // 4. ตรวจสอบว่า code ถูก activate แล้ว (มี voucherGroupId)
      if (!voucherCode.voucherGroupId) {
        this.logger.error(`[ERROR] Code not yet activated`);
        throw new BadRequestException(
          `This voucher code has not been activated yet`,
        );
      }

      // 5. ตรวจสอบว่า voucher ยังไม่หมดอายุ
      this.logger.log(`[STEP 5] Checking voucher validity`);
      const now = new Date();
      const voucher = voucherCode.voucher;

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

      // 6. Point Balance Validation
      this.logger.log(
        `[STEP 6] Checking customer point balance for ${voucherCode.currency}`,
      );
      const customerPoint = await this.prisma.customerPoint.findFirst({
        where: {
          customerId,
          pointId: voucherCode.pointId,
        },
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

      // 7. Get customer wallet (address + privateKey) for signing and payments
      const customerWallet = await this.prisma.wallet.findUnique({
        where: { id: customer.walletId },
      });

      if (!customerWallet?.walletAddress || !customerWallet?.privateKey) {
        throw new BadRequestException('Customer wallet not configured');
      }
      const walletAddress = customerWallet.walletAddress;

      // 7.5. Decrypt customer private key
      this.logger.log(`[STEP 7.5] Decrypting customer private key`);
      const salt = this.configService.get<string>('SALT');
      const decryptedPrivateKey = this.tokenService.decryptKey(
        salt,
        customerWallet.privateKey,
      );

      if (!decryptedPrivateKey) {
        throw new Error('Failed to decrypt customer private key');
      }

      // 7.6. Check and add customer to marketplace whitelist if needed
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

      // 8. On-chain purchase using ERC-20 (point) via marketplace
      this.logger.log(
        `[STEP 8] Calling smart contract buyCoupon on marketplace`,
      );
      let blockchainTx = null;

      try {
        // Get listing details from marketplace to validate payment token
        if (!voucherCode.voucherGroupId) {
          throw new BadRequestException(
            'Voucher is not listed on marketplace (missing listingId)',
          );
        }

        // Validate voucherGroupId is numeric format (not old UUID format)
        if (!/^\d+$/.test(voucherCode.voucherGroupId)) {
          throw new BadRequestException(
            'This voucher code uses an old system format and cannot be purchased from marketplace. ' +
              'Please contact the merchant to re-activate this voucher. ' +
              `Current voucherGroupId: ${voucherCode.voucherGroupId}`,
          );
        }

        const listingId = voucherCode.voucherGroupId;
        const listing =
          await this.blockchainService.getMarketplaceListing(listingId);

        if (!listing.isActive) {
          throw new BadRequestException(
            `Listing ${listingId} is not active. This listing may have been sold out or cancelled.`,
          );
        }

        // Verify listing seller matches the merchant who owns this voucher
        const merchant = await this.prisma.merchant.findUnique({
          where: { id: voucher.merchantId },
          select: {
            wallet: {
              select: {
                walletAddress: true,
              },
            },
          },
        });

        if (!merchant?.wallet?.walletAddress) {
          throw new BadRequestException('Merchant wallet not found');
        }

        const merchantAddress = merchant.wallet.walletAddress.toLowerCase();
        const listingSeller = listing.seller.toLowerCase();

        if (listingSeller !== merchantAddress) {
          this.logger.error(
            `[ERROR] Listing seller mismatch. Listing seller: ${listingSeller}, Merchant address: ${merchantAddress}`,
          );
          throw new BadRequestException(
            `This listing belongs to a different seller. The merchant may need to re-activate this voucher. ` +
              `Expected seller: ${merchantAddress}, Actual seller: ${listingSeller}`,
          );
        }

        this.logger.log(`[STEP 8] Listing seller verified ✓`);

        // Validate payment token matches point contract (customer pays with point token)
        if (voucherCode.point?.contractAddress) {
          const expectedPointAddress = convertBufferToAddress(
            voucherCode.point.contractAddress as any,
          ).toLowerCase();
          if (listing.paymentToken.toLowerCase() !== expectedPointAddress) {
            throw new BadRequestException(
              `Listing payment token mismatch. Expected point token: ${expectedPointAddress}, got: ${listing.paymentToken}`,
            );
          }
        }

        blockchainTx = await this.blockchainService.buyCoupon(
          listingId,
          1, // Buy 1 unit
          decryptedPrivateKey, // Buyer signs with decrypted key
        );

        this.logger.log(
          `[STEP 8] Marketplace purchase successful. Tx: ${blockchainTx.hash}`,
        );
      } catch (error) {
        this.logger.error(
          `[ERROR] Marketplace purchase failed: ${error.message}`,
        );
        throw new BadRequestException(
          `Failed to buy voucher from marketplace: ${error.message}`,
        );
      }

      // 9. Transfer ownership - อัพเดท database และหัก balance off-chain ให้สอดคล้อง
      this.logger.log(`[STEP 9] Updating database - transferring ownership`);

      // Get merchant wallet address for receiver
      const merchantWallet = await this.prisma.wallet.findFirst({
        where: { merchant: { id: voucherCode.voucher.merchantId } },
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

      // Generate shared transactionRefId for linked transactions
      const transactionRefId = randomUUID();

      const [, , purchaseTransaction, transferTransaction] =
        await this.prisma.$transaction([
          // Update current owner
          this.prisma.voucherCode.update({
            where: { id: voucherCodeId },
            data: { currentOwnerId: customerId },
          }),

          // Deduct customer point balance (off-chain ledger to mirror on-chain spend)
          this.prisma.customerPoint.update({
            where: { id: customerPoint.id },
            data: {
              balances: {
                decrement: voucherCode.pointsCost,
              },
            },
          }),

          // Transaction 1: MARKETPLACE_PURCHASE - Payment from customer to merchant
          this.prisma.transaction.create({
            data: {
              txHash: txHashBuffer,
              senderAddress: customerAddressBuffer,
              receiverAddress: merchantAddressBuffer,
              amount: voucherCode.pointsCost,
              pointId: voucherCode.pointId,
              merchantId: voucherCode.voucher.merchantId,
              senderId: customerId,
              receiverId: null, // Merchant is receiver but not a customer
              merchantReceiverId: voucherCode.voucher.merchantId, // Merchant received payment
              voucherCodeId: voucherCodeId,
              transactionTypeId: TransactionTypeId.MARKETPLACE_PURCHASE,
              type: AssetType.VOUCHER,
              transactionRefId,
            } as any,
          }),

          // Transaction 2: VOUCHER_TRANSFER - Voucher ownership transfer to customer
          this.prisma.transaction.create({
            data: {
              txHash: txHashBuffer,
              senderAddress: merchantAddressBuffer, // Merchant/marketplace sends voucher
              receiverAddress: customerAddressBuffer, // Customer receives voucher
              amount: 1, // 1 voucher unit
              pointId: voucherCode.pointId,
              merchantId: voucherCode.voucher.merchantId,
              senderId: null, // Merchant is sender but not a customer
              receiverId: customerId, // Customer receives voucher
              merchantReceiverId: null,
              voucherCodeId: voucherCodeId,
              transactionTypeId: TransactionTypeId.VOUCHER_TRANSFER,
              type: AssetType.VOUCHER,
              transactionRefId,
            } as any,
          }),
        ]);

      // Update ListingBatch soldItems if this voucher code belongs to a batch
      if (voucherCode.listingBatchId) {
        await this.prisma.listingBatch.update({
          where: { id: voucherCode.listingBatchId },
          data: {
            soldItems: { increment: 1 },
          },
        });

        // Check if batch is sold out and update status
        const batch = await this.prisma.listingBatch.findUnique({
          where: { id: voucherCode.listingBatchId },
          select: { totalItems: true, soldItems: true },
        });

        if (batch && batch.soldItems >= batch.totalItems) {
          await this.prisma.listingBatch.update({
            where: { id: voucherCode.listingBatchId },
            data: { status: 'SOLD_OUT' },
          });
          this.logger.log(
            `[INFO] ListingBatch ${voucherCode.listingBatchId} is now SOLD_OUT`,
          );
        }
      }

      this.logger.log(
        `[SUCCESS] Coupon purchased successfully from marketplace. Payment Transaction ID: ${purchaseTransaction.id}, Transfer Transaction ID: ${transferTransaction.id}`,
      );

      // Return response
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
            type: TransactionTypeId.MARKETPLACE_PURCHASE,
            amount: voucherCode.pointsCost,
            from: walletAddress,
            to: merchantWallet.walletAddress,
            createdAt: purchaseTransaction.createdAt,
          },
          transfer: {
            id: transferTransaction.id,
            type: TransactionTypeId.VOUCHER_TRANSFER,
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
          merchantName: voucher.merchant?.name || '',
          startDate: voucher.startDate,
          endDate: voucher.endDate,
        },
        blockchain: blockchainTx
          ? {
              transactionHash: blockchainTx.hash,
              blockNumber: blockchainTx.blockNumber,
            }
          : null,
      };
    } catch (error) {
      this.logger.error(
        `[FATAL ERROR] Failed to buy coupon from marketplace: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
