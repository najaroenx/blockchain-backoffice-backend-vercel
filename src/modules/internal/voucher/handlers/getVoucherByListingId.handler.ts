import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';
import { PrismaService } from 'prisma/prisma.service';
import { GetVoucherByListingResponseDto } from '../dtos/get-voucher-by-listing.dto';

@Injectable()
export class GetVoucherByListingId {
  private logger = new Logger(GetVoucherByListingId.name);

  constructor(
    private blockchainService: BlockchainService,
    private prisma: PrismaService,
  ) {}

  async execute(listingId?: string): Promise<GetVoucherByListingResponseDto> {
    try {
      this.logger.log(
        `[GetVoucherByListingId] Step 1: Starting execution with ListingId: ${listingId}`,
      );

      // Use single RPC call instead of fetching ALL active listings
      this.logger.log(
        `[GetVoucherByListingId] Step 2: Fetching single listing ${listingId} from blockchain`,
      );

      let objectListings;
      try {
        const listing =
          await this.blockchainService.getMarketplaceListing(listingId);

        if (!listing.isActive) {
          throw new NotFoundException(
            `Listing with ID ${listingId} is not active`,
          );
        }

        objectListings = {
          listingId,
          ...listing,
        };
      } catch (error) {
        if (error instanceof NotFoundException) throw error;
        this.logger.log(
          `[GetVoucherByListingId] Step 3: No listing found for listingId: ${listingId}`,
        );
        throw new NotFoundException(`Listing with ID ${listingId} not found`);
      }

      this.logger.log(
        `[GetVoucherByListingId] Step 4: Listing found (seller=${objectListings.seller}, typeId=${objectListings.typeId}), querying database...`,
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
              merchant: {
                select: {
                  id: true,
                },
              },
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
      this.logger.log(
        `[107GetVoucherByListingId] Step 10: Voucher found for listing ${listingId}:`,
        voucherCodes,
      );
      // TODO: for temporary use
      const availableCount = await this.prisma.voucherCode.count({
        where: {
          voucherId: voucherCodes.voucherId,
          voucherGroupId: voucherCodes.voucherGroupId,
          isUsed: false,
          currentOwnerId: {
            not: null,
          },
        },
      });
      this.logger.log(
        `[GetVoucherByListingId] Step 11: Available count for voucher ${voucherCodes.voucherId}: ${availableCount} : ${voucherCodes.voucherGroupId}`,
      );
      (voucherCodes.voucher as any).totalRedeemed = availableCount || 0;
      (voucherCodes.voucher as any).totalAvailable = availableCount || 0;
      return voucherCodes as unknown as GetVoucherByListingResponseDto;
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
