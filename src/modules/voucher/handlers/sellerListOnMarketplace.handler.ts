import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SellerListOnMarketplace {
  private logger = new Logger(SellerListOnMarketplace.name);

  constructor(
    private prisma: PrismaService,
    private blockchainService: BlockchainService,
    private configService: ConfigService,
  ) {}

  async execute(
    voucherId: string,
    amount: number,
    pricePerUnitTHB: number,
    sellerWalletAddress: string,
  ): Promise<any> {
    try {
      this.logger.log(
        `[START] Seller listing voucher on marketplace. VoucherId: ${voucherId}, Amount: ${amount}, Price: ${pricePerUnitTHB} THB`,
      );

      // 1. Validate voucher exists
      this.logger.log(`[STEP 1] Validating voucher ${voucherId}`);
      const voucher = await this.prisma.voucher.findUnique({
        where: { id: voucherId },
        select: {
          id: true,
          name: true,
          tokenId: true,
          totalIssued: true,
          status: true,
          merchantId: true,
        },
      });

      if (!voucher) {
        this.logger.error(`[ERROR] Voucher ${voucherId} not found`);
        throw new NotFoundException(`Voucher ${voucherId} not found`);
      }

      // Seller vouchers should have no merchantId yet
      if (voucher.merchantId) {
        this.logger.error(
          `[ERROR] Voucher already assigned to merchant ${voucher.merchantId}`,
        );
        throw new BadRequestException(
          'This voucher is already assigned to a merchant. Only unassigned vouchers can be listed by sellers.',
        );
      }

      if (!voucher.tokenId) {
        this.logger.error(`[ERROR] Voucher has no tokenId (NFT not minted)`);
        throw new BadRequestException(
          'Voucher must have a tokenId. Please mint the NFT first.',
        );
      }

      if (amount > voucher.totalIssued) {
        this.logger.error(
          `[ERROR] Amount ${amount} exceeds totalIssued ${voucher.totalIssued}`,
        );
        throw new BadRequestException(
          `Cannot list ${amount} vouchers. Only ${voucher.totalIssued} available.`,
        );
      }

      this.logger.log(
        `[STEP 1] Voucher validated. TokenId: ${voucher.tokenId}, Status: ${voucher.status}`,
      );

      // 2. Get seller wallet from database by address
      this.logger.log(`[STEP 2] Finding seller wallet`);
      const sellerWallet = await this.prisma.wallet.findFirst({
        where: {
          walletAddress: sellerWalletAddress.toLowerCase(),
        },
        select: {
          id: true,
          walletAddress: true,
          privateKey: true,
        },
      });

      if (!sellerWallet?.privateKey) {
        this.logger.error(
          `[ERROR] Seller wallet ${sellerWalletAddress} not found or has no private key`,
        );
        throw new BadRequestException(
          'Seller wallet not found in system or missing private key. Please register wallet first.',
        );
      }

      this.logger.log(`[STEP 2] Seller wallet found`);

      // 3. Get THB token address
      const thbAddress = this.configService.get<string>('THB_ADDRESS');
      if (!thbAddress) {
        throw new BadRequestException('THB_ADDRESS not configured');
      }

      this.logger.log(`[STEP 3] Using THB token: ${thbAddress}`);

      // 4. Check if seller is whitelisted in marketplace, if not add to whitelist
      this.logger.log(`[STEP 4] Checking seller whitelist status`);
      const isWhitelisted =
        await this.blockchainService.isWhitelisted(sellerWalletAddress);

      if (!isWhitelisted) {
        this.logger.log(
          `[STEP 4] Seller not whitelisted, adding to whitelist...`,
        );
        await this.blockchainService.addToMarketplaceWhitelist(
          sellerWalletAddress,
        );
        this.logger.log(`[STEP 4] Seller whitelisted successfully`);
      } else {
        this.logger.log(`[STEP 4] Seller already whitelisted`);
      }

      // 5. Mint NFT coupons to seller
      this.logger.log(
        `[STEP 5] Minting ${amount} NFT coupons to seller (tokenId: ${voucher.tokenId})`,
      );
      const mintResult = await this.blockchainService.mintCoupon(
        sellerWalletAddress,
        voucher.tokenId,
        amount,
      );
      this.logger.log(
        `[STEP 5] Minted successfully. TxHash: ${mintResult.hash}, Block: ${mintResult.blockNumber}`,
      );

      // 6. List on marketplace with THB as payment token
      // Note: listCoupon() will automatically approve marketplace for coupon transfer
      this.logger.log(
        `[STEP 6] Listing on blockchain marketplace with THB token`,
      );
      const listResult = await this.blockchainService.listCoupon(
        voucher.tokenId,
        amount,
        pricePerUnitTHB.toString(),
        sellerWallet.privateKey,
        thbAddress, // Payment token = THB for seller listings
      );

      this.logger.log(
        `[STEP 6] Successfully listed on marketplace. ListingId: ${listResult.listingId}, TxHash: ${listResult.hash}`,
      );

      // 7. Create VoucherCode records for this listing
      this.logger.log(
        `[STEP 7] Creating ${amount} voucher codes for listing ${listResult.listingId}`,
      );

      // Generate codes for this listing
      const voucherCodes = [];
      for (let i = 0; i < amount; i++) {
        const code = `${voucher.tokenId}-SELLER-${listResult.listingId}-${i + 1}`;
        voucherCodes.push({
          code,
          voucherId: voucher.id,
          voucherGroupId: listResult.listingId, // Mark as listed on marketplace
          pointsCost: Math.round(pricePerUnitTHB), // Store THB price as integer
          pointId: null, // No Point currency - using THB
          currency: 'THB', // Denormalized currency symbol
          isUsed: false,
          currentOwnerId: null, // Not yet purchased by merchant
        });
      }

      await this.prisma.voucherCode.createMany({
        data: voucherCodes,
      });

      this.logger.log(
        `[STEP 7] Created ${amount} voucher codes with listing ID ${listResult.listingId}`,
      );

      return {
        listing: {
          voucherId: voucher.id,
          voucherName: voucher.name,
          listingId: listResult.listingId,
          tokenId: voucher.tokenId,
          amount,
          pricePerUnitTHB,
          totalPriceTHB: pricePerUnitTHB * amount,
          paymentToken: thbAddress,
          seller: sellerWalletAddress,
        },
        blockchain: {
          transactionHash: listResult.hash,
          blockNumber: listResult.blockNumber,
        },
        nextSteps: {
          message:
            'Vouchers are now listed on marketplace. Merchants can purchase using the listingId.',
          merchantEndpoint: 'POST /coupon/merchant/buy-from-seller',
          requiredData: {
            listingId: listResult.listingId,
            amount: 'number of vouchers to buy',
            merchantId: 'merchant ID',
          },
        },
      };
    } catch (error) {
      this.logger.error(
        `[FATAL ERROR] Failed to list voucher on marketplace: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
