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
import { randomUUID } from 'crypto';
import { ethers } from 'ethers';
import { getSignerFromSeedPhrase } from 'src/libs/derive-wallet';

/**
 * Handler for merchant purchasing vouchers from seller using THB token
 *
 * ⚠️ PHASE 1 FEATURE: Auto-mint THB on insufficient balance
 * - Automatically checks merchant's THB balance before purchase
 * - If balance is insufficient, auto-mints the shortage amount
 * - Uses backend admin private key to mint THB tokens
 *
 * PHASE 2+ IMPROVEMENTS:
 * - Replace auto-mint with payment gateway
 * - Require merchant to deposit real money first
 * - Implement proper accounting and audit trail
 * - Add transaction limits and approval workflow
 */
@Injectable()
export class MerchantBuyCouponFromSeller {
  private logger = new Logger(MerchantBuyCouponFromSeller.name);

  constructor(
    private prisma: PrismaService,
    private blockchainService: BlockchainService,
    private tokenService: TokenService,
    private configService: ConfigService,
  ) {}

  async execute(
    listingId: string,
    amount: number,
    merchantId: string,
  ): Promise<any> {
    try {
      this.logger.log(
        `[START] Merchant buying coupon from seller. ListingId: ${listingId}, Amount: ${amount}, MerchantId: ${merchantId}`,
      );

      // 1. Get merchant wallet and validate
      this.logger.log(`[STEP 1] Fetching merchant wallet`);
      const merchant = await this.prisma.merchant.findUnique({
        where: { id: merchantId },
        select: {
          id: true,
          name: true,
          walletId: true,
        },
      });

      if (!merchant) {
        this.logger.error(`[ERROR] Merchant ${merchantId} not found`);
        throw new NotFoundException(`Merchant ${merchantId} not found`);
      }

      if (!merchant.walletId) {
        this.logger.error(`[ERROR] Merchant ${merchantId} has no wallet`);
        throw new BadRequestException(
          'Merchant wallet not configured. Please set up wallet first.',
        );
      }

      const merchantWallet = await this.prisma.wallet.findUnique({
        where: { id: merchant.walletId },
        select: {
          walletAddress: true,
          seedPhrase: true,
          derivationIndex: true,
        },
      });

      if (!merchantWallet?.seedPhrase) {
        throw new BadRequestException('Merchant wallet seed phrase not found');
      }

      this.logger.log(
        `[STEP 1] Merchant wallet: ${merchantWallet.walletAddress}`,
      );

      // 2. Get marketplace listing details
      this.logger.log(`[STEP 2] Fetching marketplace listing`);
      const listing =
        await this.blockchainService.getMarketplaceListing(listingId);

      if (!listing.isActive) {
        throw new BadRequestException('Listing is not active');
      }

      // Validate this is a seller listing (payment token should be THB)
      const thbAddress = process.env.THB_ADDRESS?.toLowerCase();
      if (listing.paymentToken.toLowerCase() !== thbAddress) {
        this.logger.error(
          `[ERROR] Listing payment token mismatch. Expected THB: ${thbAddress}, got: ${listing.paymentToken}`,
        );
        throw new BadRequestException(
          'This listing is not a seller listing. Sellers must use THB token as payment.',
        );
      }

      // Convert price from string to BigInt (price is in Wei)
      const pricePerUnitWei = ethers.parseEther(
        listing.pricePerUnit.toString(),
      );
      const totalPriceWei = pricePerUnitWei * BigInt(amount);

      this.logger.log(
        `[STEP 2] Listing validated. Seller: ${listing.seller}, TypeId: ${listing.typeId}, Price per unit: ${listing.pricePerUnit} ETH (${pricePerUnitWei.toString()} Wei), Total: ${ethers.formatEther(totalPriceWei)} ETH`,
      );

      // 3. Decrypt merchant seed phrase and derive private key
      this.logger.log(
        `[STEP 3] Decrypting merchant seed phrase and deriving private key`,
      );
      const salt = this.configService.get<string>('SALT');
      const decryptedSeedPhrase = this.tokenService.decryptKey(
        salt,
        merchantWallet.seedPhrase,
      );

      if (!decryptedSeedPhrase) {
        throw new Error('Failed to decrypt merchant seed phrase');
      }

      // Derive private key from seed phrase
      const merchantSigner = getSignerFromSeedPhrase(
        decryptedSeedPhrase,
        merchantWallet.derivationIndex,
      );
      const decryptedPrivateKey = merchantSigner.privateKey;

      // 4. Check THB balance and auto-mint if insufficient (PHASE 1)
      this.logger.log(
        `[STEP 4] Checking merchant THB balance for ${merchantWallet.walletAddress}`,
      );
      const balanceInfo = await this.blockchainService.getUserTHBBalance(
        merchantWallet.walletAddress,
      );
      const currentBalance = BigInt(balanceInfo.balanceWei);
      const requiredAmount = totalPriceWei;

      this.logger.log(
        `[STEP 4] Current THB balance: ${ethers.formatEther(currentBalance)} THB, Required: ${ethers.formatEther(requiredAmount)} THB`,
      );

      if (currentBalance < requiredAmount) {
        const shortage = requiredAmount - currentBalance;
        this.logger.warn(
          `[STEP 4] ⚠️ PHASE 1 AUTO-MINT: Insufficient THB balance. Shortage: ${ethers.formatEther(shortage)} THB`,
        );
        this.logger.warn(
          `[STEP 4] ⚠️ Automatically minting ${ethers.formatEther(shortage)} THB to merchant wallet`,
        );

        // Auto-mint THB using backend admin wallet
        const mintResult = await this.blockchainService.mintTHB(
          merchantWallet.walletAddress,
          shortage,
        );

        this.logger.warn(
          `[STEP 4] ✅ Auto-minted ${ethers.formatEther(shortage)} THB. TxHash: ${mintResult.hash}`,
        );

        // Record THB auto-mint transaction in database
        const mintTxHashBuffer = Buffer.from(mintResult.hash.slice(2), 'hex');
        const merchantAddressBuffer = Buffer.from(
          merchantWallet.walletAddress.slice(2),
          'hex',
        );
        const systemAddressBuffer = Buffer.alloc(20, 0); // System/zero address for mint

        const shortageAmountTHB = Math.round(
          parseFloat(ethers.formatEther(shortage)),
        );

        await this.prisma.transaction.create({
          data: {
            txHash: mintTxHashBuffer,
            senderAddress: systemAddressBuffer,
            receiverAddress: merchantAddressBuffer,
            amount: shortageAmountTHB,
            pointId: null,
            merchantId: merchantId,
            senderId: null, // System mint
            receiverId: merchantId,
            voucherCodeId: null,
            transactionTypeId: TransactionTypeId.THB_MINT,
            type: AssetType.THB_TOKEN,
            senderType: ParticipantType.SYSTEM,
            receiverType: ParticipantType.MERCHANT,
            transactionRefId: randomUUID(),
          } as any,
        });

        this.logger.log(
          `[STEP 4] ✅ THB_MINT transaction recorded. Amount: ${shortageAmountTHB} THB`,
        );
      } else {
        this.logger.log(
          `[STEP 4] ✅ Sufficient THB balance. No auto-mint needed.`,
        );
      }

      // 5. Purchase from marketplace using THB token
      this.logger.log(`[STEP 5] Executing blockchain purchase with THB token`);
      const blockchainTx = await this.blockchainService.buyCoupon(
        listingId,
        amount,
        decryptedPrivateKey,
      );

      this.logger.log(
        `[STEP 5] Blockchain purchase successful. Tx: ${blockchainTx.hash}, Block: ${blockchainTx.blockNumber}`,
      );

      // 6. Create transaction records (payment + voucher receipt)
      this.logger.log(`[STEP 6] Creating transaction records`);

      // Convert Wei to THB amount (Int) for database
      // Note: Transaction.amount field stores THB value as integer, not Wei
      const amountTHB = Math.round(
        parseFloat(ethers.formatEther(totalPriceWei)),
      );

      const txHashBuffer = Buffer.from(blockchainTx.hash.slice(2), 'hex');
      const senderAddressBuffer = Buffer.from(
        merchantWallet.walletAddress.slice(2),
        'hex',
      );
      const receiverAddressBuffer = Buffer.from(listing.seller.slice(2), 'hex');

      // Generate transaction reference ID for linking related transactions
      const transactionRefId = randomUUID();

      // Create THB_BUY transaction record (merchant pays THB to seller/vault)
      const transaction = await this.prisma.transaction.create({
        data: {
          txHash: txHashBuffer,
          senderAddress: senderAddressBuffer,
          receiverAddress: receiverAddressBuffer,
          amount: amountTHB,
          pointId: null, // THB purchase, not point-based
          merchantId: merchantId,
          senderId: merchantId, // Merchant paid
          receiverId: null, // Seller not tracked in DB (goes to Vault)
          voucherCodeId: null,
          transactionTypeId: TransactionTypeId.THB_BUY,
          type: AssetType.THB_TOKEN,
          senderType: ParticipantType.MERCHANT,
          receiverType: ParticipantType.SYSTEM, // Seller wallet (external) treated as SYSTEM
          transactionRefId: transactionRefId,
        } as any,
      });

      this.logger.log(
        `[STEP 6] THB_BUY transaction created. ID: ${transaction.id}`,
      );

      // 7. Update voucher status to 'upcoming' and assign to merchant
      this.logger.log(`[STEP 7] Updating voucher status to 'upcoming'`);

      const voucher = await this.prisma.voucher.findFirst({
        where: {
          tokenId: listing.typeId,
          merchantId: null, // Still unassigned (from seller)
        },
      });

      if (voucher) {
        // Calculate THB price per unit
        const thbPricePerUnit = parseFloat(listing.pricePerUnit);

        await this.prisma.voucher.update({
          where: { id: voucher.id },
          data: {
            status: 'upcoming',
            merchantId: merchantId,
            merchantName: merchant.name,
            thbPurchasePrice: thbPricePerUnit, // บันทึกราคา THB ต่อ unit ที่ซื้อมา
          },
        });

        this.logger.log(
          `[STEP 7] Voucher ${voucher.id} updated to 'upcoming' and assigned to merchant ${merchant.name} (thbPurchasePrice: ${thbPricePerUnit} THB)`,
        );

        // 8. ลบ codes ตามจำนวน amount ที่ซื้อ (ไม่ใช่ทั้งหมด)
        this.logger.log(
          `[STEP 8] Removing ${amount} seller placeholder codes for voucher ${voucher.id}`,
        );

        // First, get the codes to find their listingBatchId before deletion (limit to amount)
        const codesToDelete = await this.prisma.voucherCode.findMany({
          where: {
            voucherId: voucher.id,
            voucherGroupId: listingId,
            pointId: null,
            currentOwnerId: null,
          },
          select: {
            id: true,
            listingBatchId: true,
          },
          take: amount, // Only take the amount being purchased
        });

        // Group by listingBatchId to update batch stats
        const batchCounts = new Map<string, number>();
        for (const code of codesToDelete) {
          if (code.listingBatchId) {
            batchCounts.set(
              code.listingBatchId,
              (batchCounts.get(code.listingBatchId) || 0) + 1,
            );
          }
        }

        // Delete only the specific codes (by ID) that were selected
        const codeIdsToDelete = codesToDelete.map((code) => code.id);
        const deletedCodesResult = await this.prisma.voucherCode.deleteMany({
          where: {
            id: { in: codeIdsToDelete },
          },
        });

        // Update ListingBatch soldItems for each affected batch
        for (const [batchId, count] of batchCounts) {
          await this.prisma.listingBatch.update({
            where: { id: batchId },
            data: {
              soldItems: { increment: count },
            },
          });

          // Check if batch is sold out
          const batch = await this.prisma.listingBatch.findUnique({
            where: { id: batchId },
            select: { totalItems: true, soldItems: true },
          });

          if (batch && batch.soldItems >= batch.totalItems) {
            await this.prisma.listingBatch.update({
              where: { id: batchId },
              data: { status: 'SOLD_OUT' },
            });
            this.logger.log(`[INFO] ListingBatch ${batchId} is now SOLD_OUT`);
          }
        }

        this.logger.log(
          `[STEP 8] Deleted ${deletedCodesResult.count} seller placeholder codes. Merchant will create new codes when activating.`,
        );
      } else {
        this.logger.warn(
          `[STEP 7] Voucher with tokenId ${listing.typeId} not found or already assigned`,
        );
      }
      this.logger.log(
        `[SUCCESS] Merchant purchased ${amount} coupons from seller. Transaction ID: ${transaction.id}`,
      );

      return {
        purchase: {
          listingId,
          amount,
          merchantId: merchant.id,
          merchantName: merchant.name,
          tokenId: listing.typeId,
          totalPriceWei: totalPriceWei.toString(),
          totalPriceTHB: ethers.formatEther(totalPriceWei),
          transactionId: transaction.id,
          purchasedAt: transaction.createdAt,
        },
        blockchain: {
          transactionHash: blockchainTx.hash,
          blockNumber: blockchainTx.blockNumber,
          seller: listing.seller,
          paymentToken: listing.paymentToken,
        },
        nextSteps: {
          message:
            'Coupons purchased successfully. Next, activate the voucher batch to list them for customers using Point tokens.',
          actionRequired: 'Call activateVoucher endpoint to list for customers',
        },
      };
    } catch (error) {
      this.logger.error(
        `[FATAL ERROR] Failed to buy coupon from seller: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
