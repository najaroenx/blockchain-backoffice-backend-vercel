import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class GetVoucherByListingId {
  private logger = new Logger(GetVoucherByListingId.name);

  constructor(
    private blockchainService: BlockchainService,
    private prisma: PrismaService,
  ) {}

  async execute(listingId?: string) {
    try {
      this.logger.log(
        `[GetVoucherByListingId] Step 1: Starting execution with ListingId: ${listingId}`,
      );

      this.logger.log(
        '[GetVoucherByListingId] Step 2: Fetching active marketplace listings from blockchain',
      );
      const blockchainListings =
        await this.blockchainService.getAllActiveMarketplaceListings();
      this.logger.log(
        `[GetVoucherByListingId] Step 3: Found ${blockchainListings.length} active listings on blockchain`,
      );

      let objectListings = null;
      this.logger.log(
        '[GetVoucherByListingId] Step 4: Searching for matching listing',
      );
      blockchainListings.forEach((listing) => {
        this.logger.log(
          `[GetVoucherByListingId] Checking listing ${listing.listingId}: ` +
            `seller=${listing.seller}, typeId=${listing.typeId}, ` +
            `amount=${listing.amount}, price=${listing.pricePerUnit}, ` +
            `isActive=${listing.isActive}`,
        );
        if (listing.listingId.toString() === listingId) {
          this.logger.log(
            `[GetVoucherByListingId] Step 5: Match found! Listing ${listing.listingId} matches requested ${listingId}`,
          );
          objectListings = listing;
        }
      });

      if (!objectListings) {
        this.logger.log(
          `[GetVoucherByListingId] Step 6: No matching listing found for listingId: ${listingId}`,
        );
        throw new NotFoundException(`Listing with ID ${listingId} not found`);
      }

      this.logger.log(
        `[GetVoucherByListingId] Step 7: Listing found, querying database for voucher codes with voucherGroupId: ${objectListings.listingId}`,
      );
      const voucherCodes = await this.prisma.voucherCode.findFirst({
        where: {
          voucherGroupId: objectListings.listingId,
        },
        include: {
          voucher: {
            include: {
              merchant: {
                select: {
                  id: true,
                  name: true,
                  wallet: {
                    select: {
                      walletAddress: true,
                    },
                  },
                },
              },
            },
          },
          point: {
            select: {
              id: true,
              name: true,
              symbol: true,
              contractAddress: true,
              imageUrl: true,
            },
          },
        },
        take: 1, // Just need one to get voucher details
      });

      if (!voucherCodes) {
        this.logger.log(
          `[GetVoucherByListingId] Step 8: No voucher code found in database for listing ${listingId}`,
        );
        throw new NotFoundException(`Listing with ID ${listingId} not found`);
      }

      this.logger.log(
        '[GetVoucherByListingId] Step 9: Execution completed successfully',
      );
      return voucherCodes;
    } catch (error) {
      this.logger.error(
        `[GetVoucherByListingId] Error occurred while fetching voucher by listing ID: ${listingId}`,
      );
      this.logger.error(
        `[GetVoucherByListingId] Error message: ${error.message}`,
      );
      this.logger.error(`[GetVoucherByListingId] Error stack: ${error.stack}`);

      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Failed to fetch voucher by listing ID',
      );
    }
  }
}
