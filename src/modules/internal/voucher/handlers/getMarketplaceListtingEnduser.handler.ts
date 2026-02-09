import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';
import { PrismaService } from 'prisma/prisma.service';
import { convertBufferToAddress } from 'src/libs/convertBufferToAddress';

@Injectable()
export class GetMarketplaceListingsEndUser {
  private logger = new Logger(GetMarketplaceListingsEndUser.name);
  private thbAddress: string;

  constructor(
    private blockchainService: BlockchainService,
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.thbAddress = this.configService.get<string>('THB_ADDRESS') || '';
  }

  /**
   * Get all active marketplace listings with voucher details
   * @param merchantId - Optional: filter by merchant
   * @param sellerOnly - Optional: filter only seller listings (THB payment token)
   * @param page - Optional: page number for pagination
   * @param limit - Optional: items per page
   */
  async execute(
    merchantId?: string,
    sellerOnly: boolean = false,
    page?: number,
    limit?: number,
  ) {
    try {
      this.logger.log(
        `[GetMarketplaceListings] Fetching active listings from blockchain... (sellerOnly=${sellerOnly}, page=${page}, limit=${limit})`,
      );

      // 1. Get all active listings from marketplace smart contract
      let blockchainListings =
        await this.blockchainService.getAllActiveMarketplaceListings();

      this.logger.log(
        `[GetMarketplaceListings] Found ${blockchainListings.length} active listings on blockchain`,
      );

      // Filter by seller listings only (THB payment token) if requested
      if (sellerOnly && this.thbAddress) {
        const beforeCount = blockchainListings.length;
        blockchainListings = blockchainListings.filter(
          (listing) =>
            listing.paymentToken.toLowerCase() ===
            this.thbAddress.toLowerCase(),
        );
        this.logger.log(
          `[GetMarketplaceListings] Filtered to ${blockchainListings.length} seller listings (from ${beforeCount}) using THB payment token`,
        );
      }

      // Log all listings for debugging
      blockchainListings.forEach((listing) => {
        this.logger.log(
          `[GetMarketplaceListings] Listing ${listing.listingId}: ` +
            `seller=${listing.seller}, typeId=${listing.typeId}, ` +
            `amount=${listing.amount}, price=${listing.pricePerUnit}, ` +
            `isActive=${listing.isActive}`,
        );
      });

      //   2. Get voucher details from database for each listing
      const listingsWithDetails = await Promise.all(
        blockchainListings.map(async (listing) => {
          try {
            const listingId = listing.listingId;

            this.logger.log(
              `[76GetMarketplaceListingsEndUser] Processing listing ${listingId}`,
            );

            // Find voucher codes with this listingId as voucherGroupId
            const voucherCodes = await this.prisma.voucherCode.findMany({
              where: {
                voucherGroupId: listingId,
                pointId: { not: null },
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

            this.logger.log(
              `[GetMarketplaceListingsEndUser] Found ${voucherCodes.length} voucher codes for listingId ${listingId}`,
            );

            if (voucherCodes.length === 0) {
              this.logger.warn(
                `[GetMarketplaceListingsEndUser] ❌ No voucher codes found in database for listingId ${listingId}`,
              );
              this.logger.warn(
                `[GetMarketplaceListingsEndUser] This means listing ${listingId} exists on blockchain but has no associated voucher codes in database`,
              );
              return null;
            }

            const voucherCode = voucherCodes[0];
            const voucher = voucherCode.voucher;
            const merchant = voucher?.merchant;
            const point = voucherCode.point;

            this.logger.log(
              `[GetMarketplaceListings] ✅ Found voucher for listingId ${listingId}: ` +
                `voucherId=${voucher?.id}, merchantId=${merchant?.id}, ` +
                `codeOwnerId=${voucherCode.currentOwnerId}, codeOwnerType=${voucherCode.currentOwnerType}, pointId=${point?.id}`,
            );

            // Filter by merchantId if provided
            // Check both: voucher owner (merchant created) OR code owner (merchant purchased from seller)
            if (merchantId) {
              const isVoucherOwner = merchant?.id === merchantId;
              const isCodeOwner =
                voucherCode.currentOwnerId === merchantId &&
                voucherCode.currentOwnerType === 'MERCHANT';

              if (!isVoucherOwner && !isCodeOwner) {
                this.logger.log(
                  `[GetMarketplaceListings] Filtered out listing ${listingId}: ` +
                    `voucher.merchantId=${merchant?.id}, code.currentOwnerId=${voucherCode.currentOwnerId} ` +
                    `do not match requested merchantId=${merchantId}`,
                );
                return null;
              }
            }

            // Get seller wallet address
            // For purchased codes, get the code owner's wallet instead of voucher merchant
            let sellerWalletAddress = merchant?.wallet?.walletAddress || '';

            // If code is owned by a merchant (purchased from seller), use that merchant's wallet
            if (
              voucherCode.currentOwnerType === 'MERCHANT' &&
              voucherCode.currentOwnerId
            ) {
              const codeOwnerMerchant = await this.prisma.merchant.findUnique({
                where: { id: voucherCode.currentOwnerId },
                select: { wallet: { select: { walletAddress: true } } },
              });
              if (codeOwnerMerchant?.wallet?.walletAddress) {
                sellerWalletAddress = codeOwnerMerchant.wallet.walletAddress;
              }
            }

            // Verify seller matches
            if (
              sellerWalletAddress.toLowerCase() !== listing.seller.toLowerCase()
            ) {
              this.logger.warn(
                `[GetMarketplaceListings] Seller mismatch for listing ${listingId}. ` +
                  `Expected: ${sellerWalletAddress}, Got: ${listing.seller}`,
              );
            }

            // For seller listings (THB payment), use blockchain amount as source of truth
            // because VoucherCodes are deleted after purchase
            const isSellerListing =
              listing.paymentToken.toLowerCase() ===
              this.thbAddress.toLowerCase();

            // Count available codes from database
            // Available = not sold to customer yet (no owner, or owned by merchant/seller)
            // Note: Using OR with null check because Prisma NOT clause doesn't include NULL values
            const dbAvailableCodes = await this.prisma.voucherCode.count({
              where: {
                voucherGroupId: listingId,
                isUsed: false,
                // Exclude codes already sold to customers (but include NULL)
                OR: [
                  { currentOwnerType: null },
                  { NOT: { currentOwnerType: 'CUSTOMER' } },
                ],
              },
            });

            // For seller listings: use blockchain amount (source of truth after purchase)
            // For others: use database count
            const totalAvailableCodes = isSellerListing
              ? parseInt(listing.amount, 10)
              : dbAvailableCodes;

            this.logger.log(
              `[GetMarketplaceListings] Listing ${listingId}: db=${dbAvailableCodes}, blockchain=${listing.amount}, totalAvailableCodes=${totalAvailableCodes}`,
            );

            return {
              listingId: listingId,
              seller: listing.seller,
              typeId: listing.typeId,
              amountOnChain: listing.amount, // Amount left on blockchain
              totalAvailableCodes, // Final available amount after purchase
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

      //   const listingsWithDetails = await this.prisma.voucherCode.findMany({
      //     where: {
      //       // voucherGroupId: listingId,
      //       currentOwnerId: merchantId,
      //       pointId: { not: null },
      //     },
      //     include: {
      //       voucher: {
      //         include: {
      //           merchant: {
      //             select: {
      //               id: true,
      //               name: true,
      //               imageUrl: true,
      //               wallet: {
      //                 select: {
      //                   walletAddress: true,
      //                 },
      //               },
      //             },
      //           },
      //         },
      //       },
      //       point: {
      //         select: {
      //           id: true,
      //           name: true,
      //           symbol: true,
      //           contractAddress: true,
      //           imageUrl: true,
      //         },
      //       },
      //     },
      //     // take: 1,// Just need one to get voucher details
      //   });
      this.logger.log(
        `[269GetMarketplaceListingsEndUser] Found ${listingsWithDetails.length} valid listings`,
      );
      // Filter out null entries (listings without voucher details or filtered by merchant)
      const validListings = listingsWithDetails.filter(
        (listing) => listing !== null,
      );

      this.logger.log(
        `[277GetMarketplaceListingsEndUser] Found ${validListings.length} valid listings`,
      );

      // Apply pagination if requested
      const total = validListings.length;
      let paginatedListings = validListings;

      if (page !== undefined && limit !== undefined) {
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        paginatedListings = validListings.slice(startIndex, endIndex);

        this.logger.log(
          `[GetMarketplaceListingsEndUser] Returning page ${page} with ${paginatedListings.length} listings (${startIndex}-${endIndex} of ${total})`,
        );

        return {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          listings: paginatedListings,
        };
      }

      this.logger.log(
        `[GetMarketplaceListings] Returning ${validListings.length} listings (no pagination)`,
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
