import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';
import { ConfigService } from '@nestjs/config';
import { TokenService } from 'src/providers/token/token.service';
import { getSignerFromSeedPhrase } from 'src/libs/derive-wallet';

@Injectable()
export class DelistMarketplaceListingHandler {
  private logger = new Logger(DelistMarketplaceListingHandler.name);

  constructor(
    private prisma: PrismaService,
    private blockchainService: BlockchainService,
    private configService: ConfigService,
    private tokenService: TokenService,
  ) {}

  async execute(listingId: string, merchantId: string) {
    this.logger.log(
      `[DelistMarketplaceListing] Merchant ${merchantId} requesting to delist ${listingId}`,
    );

    // 1. Verify listing exists via VoucherCode
    const voucherCodes = await this.prisma.voucherCode.findMany({
      where: { voucherGroupId: listingId },
      include: { voucher: true },
    });

    if (voucherCodes.length === 0) {
      this.logger.warn(
        `[DelistMarketplaceListing] Listing ${listingId} not found in database.`,
      );
      // Still try to see if it's a seller batch
    }

    let ownerId: string | undefined | null;

    if (voucherCodes.length > 0) {
      const firstCode = voucherCodes[0];
      ownerId =
        firstCode.currentOwnerType === 'MERCHANT'
          ? firstCode.currentOwnerId
          : firstCode.voucher?.merchantId;
    } else {
      // It might be an empty listing, check if merchant exists, we'll just try to delist anyway using their wallet
      ownerId = merchantId;
    }

    if (ownerId && ownerId !== merchantId) {
      throw new BadRequestException(
        `Merchant ${merchantId} is not the owner of listing ${listingId}.`,
      );
    }

    // 2. Get merchant's private key
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
      include: { wallet: true },
    });

    if (!merchant?.wallet?.seedPhrase) {
      throw new BadRequestException(
        `Merchant wallet not found for merchant ${merchantId}`,
      );
    }

    const salt = this.configService.get<string>('SALT');
    const decryptedSeedPhrase = this.tokenService.decryptKey(
      salt,
      merchant.wallet.seedPhrase,
    );

    if (!decryptedSeedPhrase) {
      throw new BadRequestException(
        `Failed to decrypt merchant wallet for ${merchantId}`,
      );
    }

    const signer = getSignerFromSeedPhrase(
      decryptedSeedPhrase,
      merchant.wallet.derivationIndex || 0,
    );

    // 3. Unlist on blockchain
    this.logger.log(
      `[DelistMarketplaceListing] Calling blockchain delistCoupon for listing ${listingId}`,
    );
    try {
      await this.blockchainService.delistCoupon(listingId, signer.privateKey);
    } catch (error) {
      this.logger.error(
        `[DelistMarketplaceListing] Blockchain delist failed: ${error.message}`,
      );
      throw new BadRequestException(
        `Failed to delist coupon on blockchain: ${error.message}`,
      );
    }

    // 4. Update Database
    if (voucherCodes.length > 0) {
      await this.prisma.voucherCode.updateMany({
        where: { voucherGroupId: listingId },
        data: {
          voucherGroupId: null,
        },
      });
    }

    this.logger.log(
      `[DelistMarketplaceListing] ✅ Successfully delisted ${listingId}`,
    );

    return {
      success: true,
      message: `Listing ${listingId} successfully delisted`,
      listingId,
      unlistedCount: voucherCodes.length,
    };
  }
}
