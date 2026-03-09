import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';
import { PrismaService } from 'prisma/prisma.service';
import { GetVoucherByListingResponseDto } from '../dtos/get-voucher-by-listing.dto';
import { MerchantRefEnrichmentService } from 'src/modules/shared/services/merchant-ref-enrichment.service';
import {
  resolveVoucherMerchantId,
  resolveVoucherMerchantName,
} from '../utils/resolve-voucher-merchant.util';

@Injectable()
export class GetVoucherByListingId {
  private logger = new Logger(GetVoucherByListingId.name);

  constructor(
    private blockchainService: BlockchainService,
    private prisma: PrismaService,
    private merchantRefEnrichment: MerchantRefEnrichmentService,
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

      // Count available voucher codes
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
        `[GetVoucherByListingId] Available count for voucher ${voucherCodes.voucherId}: ${availableCount} : ${voucherCodes.voucherGroupId}`,
      );

      // Enrich merchantRef detail
      const merchantRef = voucherCodes.voucher.merchantRef;
      const merchantRefDetail = merchantRef
        ? await this.merchantRefEnrichment.enrich(merchantRef)
        : null;

      let resolvedMerchant = voucherCodes.voucher.merchant;
      const resolvedMerchantId = resolveVoucherMerchantId(voucherCodes.voucher);

      if (!resolvedMerchant && resolvedMerchantId) {
        resolvedMerchant = await this.prisma.merchant.findUnique({
          where: { id: resolvedMerchantId },
          select: {
            id: true,
            name: true,
            wallet: {
              select: {
                walletAddress: true,
              },
            },
          },
        });
      }

      // Build structured response (same pattern as other handlers)
      const { voucher, point, ...codeFields } = voucherCodes;

      return {
        ...codeFields,
        voucher: {
          id: voucher.id,
          tokenId: voucher.tokenId,
          name: voucher.name,
          description: voucher.description,
          status: voucher.status,
          merchantName: resolveVoucherMerchantName(voucher),
          merchantId: resolvedMerchantId,
          merchantRef: voucher.merchantRef,
          sellerMerchantId: voucher.sellerMerchantId,
          valueType: voucher.valueType,
          value: voucher.value,
          thbPurchasePrice: voucher.thbPurchasePrice,
          currency: voucher.currency,
          startDate: voucher.startDate,
          endDate: voucher.endDate,
          totalIssued: voucher.totalIssued,
          totalRedeemed: availableCount || 0,
          totalAvailable: availableCount || 0,
          imageUrl: voucher.imageUrl,
          limitPerMember: voucher.limitPerMember,
          createdAt: voucher.createdAt,
          updatedAt: voucher.updatedAt,
          merchant: resolvedMerchant,
          merchantRefDetail: merchantRefDetail || null,
        },
        point: point || null,
      } as unknown as GetVoucherByListingResponseDto;
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
