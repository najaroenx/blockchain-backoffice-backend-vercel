import { Injectable, Logger } from '@nestjs/common';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';
import { PrismaService } from 'prisma/prisma.service';
import { convertBufferToAddress } from 'src/libs/convertBufferToAddress';

@Injectable()
export class GetMarketplaceListings {
  private logger = new Logger(GetMarketplaceListings.name);

  constructor(
    private blockchainService: BlockchainService,
    private prisma: PrismaService,
  ) {}

  /**
   * Get all active marketplace listings with voucher details
   * Filters by merchant if merchantId provided
   */
  async execute(merchantId?: string) {
    try {
      this.logger.log(
        '[GetMarketplaceListings] Fetching active listings from blockchain...',
      );

      // 1. Get all active listings from marketplace smart contract
      const blockchainListings =
        await this.blockchainService.getAllActiveMarketplaceListings();

      this.logger.log(
        `[GetMarketplaceListings] Found ${blockchainListings.length} active listings on blockchain`,
      );

      // Log all listings for debugging
      blockchainListings.forEach((listing) => {
        this.logger.log(
          `[GetMarketplaceListings] Listing ${listing.listingId}: ` +
            `seller=${listing.seller}, typeId=${listing.typeId}, ` +
            `amount=${listing.amount}, price=${listing.pricePerUnit}, ` +
            `isActive=${listing.isActive}`,
        );
      });

      // 2. Get voucher details from database for each listing
      const listingsWithDetails = await Promise.all(
        blockchainListings.map(async (listing) => {
          try {
            const listingId = listing.listingId;

            this.logger.log(
              `[GetMarketplaceListings] Processing listing ${listingId}`,
            );

            // Find voucher codes with this listingId as voucherGroupId
            const voucherCodes = await this.prisma.voucherCode.findMany({
              where: {
                voucherGroupId: listingId,
              },
              include: {
                voucher: {
                  include: {
                    merchant: {
                      select: {
                        id: true,
                        name: true,
                        imageUrl: true,
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

            if (voucherCodes.length === 0) {
              this.logger.warn(
                `[GetMarketplaceListings] ❌ No voucher codes found in database for listingId ${listingId}`,
              );
              this.logger.warn(
                `[GetMarketplaceListings] This means listing ${listingId} exists on blockchain but has no associated voucher codes in database`,
              );
              return null;
            }

            const voucherCode = voucherCodes[0];
            const voucher = voucherCode.voucher;
            const merchant = voucher?.merchant;
            const point = voucherCode.point;

            this.logger.log(
              `[GetMarketplaceListings] ✅ Found voucher for listingId ${listingId}: ` +
                `voucherId=${voucher?.id}, merchantId=${merchant?.id}, pointId=${point?.id}`,
            );

            // Filter by merchantId if provided
            if (merchantId && merchant?.id !== merchantId) {
              this.logger.log(
                `[GetMarketplaceListings] Filtered out listing ${listingId}: ` +
                  `merchant ${merchant?.id} does not match requested ${merchantId}`,
              );
              return null;
            }

            // Get seller wallet address
            const sellerWalletAddress = merchant?.wallet?.walletAddress || '';

            // Verify seller matches
            if (
              sellerWalletAddress.toLowerCase() !== listing.seller.toLowerCase()
            ) {
              this.logger.warn(
                `[GetMarketplaceListings] Seller mismatch for listing ${listingId}. ` +
                  `Expected: ${sellerWalletAddress}, Got: ${listing.seller}`,
              );
            }

            // Count total available codes for this listing
            const totalAvailableCodes = await this.prisma.voucherCode.count({
              where: {
                voucherGroupId: listingId,
                currentOwnerId: null, // Not yet purchased
                isUsed: false,
              },
            });

            this.logger.log(
              `[GetMarketplaceListings] Listing ${listingId} has ${totalAvailableCodes} available codes in database`,
            );

            return {
              listingId: listingId,
              seller: listing.seller,
              typeId: listing.typeId,
              amountOnChain: listing.amount, // Amount left on blockchain
              totalAvailableCodes, // Amount in database
              pricePerUnit: listing.pricePerUnit,
              paymentToken: listing.paymentToken,
              isActive: listing.isActive,
              listedAt: listing.listedAt,
              // Voucher details from database
              voucher: voucher
                ? {
                    id: voucher.id,
                    name: voucher.name,
                    description: voucher.description,
                    imageUrl: voucher.imageUrl,
                    valueType: voucher.valueType,
                    value: voucher.value,
                    startDate: voucher.startDate,
                    endDate: voucher.endDate,
                    status: voucher.status,
                    merchant: merchant
                      ? {
                          id: merchant.id,
                          name: merchant.name,
                          walletAddress: sellerWalletAddress,
                          imageUrl: merchant.imageUrl,
                        }
                      : null,
                    point: point
                      ? {
                          id: point.id,
                          name: point.name,
                          symbol: point.symbol,
                          contractAddress: convertBufferToAddress(
                            point.contractAddress as any,
                          ),
                          imageUrl: point.imageUrl,
                        }
                      : null,
                  }
                : null,
            };
          } catch (error) {
            this.logger.error(
              `[GetMarketplaceListings] Error processing listing ${listing.listingId}: ${error.message}`,
            );
            return null;
          }
        }),
      );

      // Filter out null entries (listings without voucher details or filtered by merchant)
      const validListings = listingsWithDetails.filter(
        (listing) => listing !== null,
      );

      this.logger.log(
        `[GetMarketplaceListings] Returning ${validListings.length} listings with details`,
      );

      return {
        total: validListings.length,
        listings: validListings,
      };
    } catch (error) {
      this.logger.error(
        `[GetMarketplaceListings] Failed to get marketplace listings: ${error.message}`,
      );
      throw error;
    }
  }
}
