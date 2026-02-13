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

        const shortageAmountTHB = Number(shortage / BigInt(10 ** 18));

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
      // Use BigInt division to avoid precision loss from parseFloat
      const amountTHB = Number(totalPriceWei / BigInt(10 ** 18));

      const txHashBuffer = Buffer.from(blockchainTx.hash.slice(2), 'hex');
      const senderAddressBuffer = Buffer.from(
        merchantWallet.walletAddress.slice(2),
        'hex',
      );
      const receiverAddressBuffer = Buffer.from(listing.seller.slice(2), 'hex');

      // Generate transaction reference ID for linking related transactions
      const transactionRefId = randomUUID();

      // 8. Get VoucherCodes being purchased (before updating them)
      this.logger.log(
        `[STEP 8] Getting ${amount} VoucherCodes for this purchase`,
      );

      // Get codes that will be transferred to merchant (limit to amount being purchased)
      // Filter by currentOwnerId = null to only get codes not yet purchased by any merchant
      const codesToTransfer = await this.prisma.voucherCode.findMany({
        where: {
          voucherGroupId: listingId,
          currentOwnerId: null, // Not yet purchased by any merchant
        },
        select: {
          id: true,
          listingBatchId: true,
        },
        take: amount,
      });

      if (codesToTransfer.length < amount) {
        throw new BadRequestException(
          `Not enough voucher codes available. Requested: ${amount}, Available: ${codesToTransfer.length}`,
        );
      }

      const purchasedCodeIds = codesToTransfer.map((c) => c.id);
      const pricePerUnitTHB = Math.round(amountTHB / amount);

      this.logger.log(
        `[STEP 8] Found ${purchasedCodeIds.length} VoucherCodes to purchase. Price per unit: ${pricePerUnitTHB} THB`,
      );

      // 9. Create THB_BUY transaction for each VoucherCode
      this.logger.log(`[STEP 9] Creating THB_BUY transactions for each code`);

      const transactions = [];
      for (const codeId of purchasedCodeIds) {
        const transaction = await this.prisma.transaction.create({
          data: {
            txHash: txHashBuffer,
            senderAddress: senderAddressBuffer,
            receiverAddress: receiverAddressBuffer,
            amount: pricePerUnitTHB,
            pointId: null,
            merchantId: merchantId,
            senderId: merchantId,
            receiverId: null,
            voucherCodeId: codeId, // Link to specific VoucherCode
            transactionTypeId: TransactionTypeId.THB_BUY,
            type: AssetType.THB_TOKEN,
            senderType: ParticipantType.MERCHANT,
            receiverType: ParticipantType.SYSTEM,
            transactionRefId: transactionRefId,
          } as any,
        });
        transactions.push(transaction);
      }

      this.logger.log(
        `[STEP 9] Created ${transactions.length} THB_BUY transactions. RefId: ${transactionRefId}`,
      );

      // 10. Update VoucherCodes ownership (no need to create new voucher)
      // VoucherCodes stay linked to seller's voucher (which has tokenId for blockchain)
      // We just mark them as owned by merchant via currentOwnerId
      this.logger.log(
        `[STEP 10] Updating ${amount} VoucherCodes ownership to merchant`,
      );

      // Update the codes we already identified in step 8
      await this.prisma.voucherCode.updateMany({
        where: {
          id: { in: purchasedCodeIds },
        },
        data: {
          // Keep voucherId linked to seller's voucher (has tokenId for blockchain)
          currentOwnerId: merchantId, // Set merchant as owner
          currentOwnerType: 'MERCHANT', // Mark owner type as MERCHANT
          // Clear voucherGroupId so merchant can activate these codes with new listingId
          voucherGroupId: null,
          // Keep listingBatchId for tracking purchase history from seller
        },
      });

      this.logger.log(
        `[STEP 10] Updated ${purchasedCodeIds.length} VoucherCodes. Merchant ${merchant.name} now owns these codes.`,
      );

      // 11. Update ListingBatch stats
      this.logger.log(`[STEP 11] Updating ListingBatch stats`);

      // Group by listingBatchId to update batch stats
      const batchCounts = new Map<string, number>();
      for (const code of codesToTransfer) {
        if (code.listingBatchId) {
          batchCounts.set(
            code.listingBatchId,
            (batchCounts.get(code.listingBatchId) || 0) + 1,
          );
        }
      }

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
        `[STEP 11] Updated ListingBatch stats. Codes retain listingBatchId for purchase tracking.`,
      );

      this.logger.log(
        `[SUCCESS] Merchant purchased ${amount} coupons from seller. Transactions created: ${transactions.length}`,
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
          transactionIds: transactions.map((t) => t.id),
          transactionRefId: transactionRefId,
          purchasedAt: transactions[0]?.createdAt,
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
