import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';
import { ConfigService } from '@nestjs/config';
import { BatchListOnMarketplaceDto } from '../dtos/batch-list-marketplace.dto';
import { ListingBatchStatus } from '@prisma/client';

export interface BatchListingItem {
  voucherId: string;
  voucherName: string;
  tokenId: string;
  listingId: string;
  amount: number;
  pricePerUnitTHB: number;
  txHash: string;
  blockNumber: number;
}

export interface BatchListingResult {
  batch: {
    id: string;
    name: string | null;
    description: string | null;
    sellerWalletAddress: string;
    totalItems: number;
    totalValue: number;
    currency: string;
    status: ListingBatchStatus;
  };
  items: BatchListingItem[];
  nextSteps: {
    message: string;
    viewListingsEndpoint: string;
    merchantBuyEndpoint: string;
  };
}

@Injectable()
export class BatchListOnMarketplaceHandler {
  private logger = new Logger(BatchListOnMarketplaceHandler.name);

  constructor(
    private prisma: PrismaService,
    private blockchainService: BlockchainService,
    private configService: ConfigService,
  ) {}

  async execute(dto: BatchListOnMarketplaceDto): Promise<BatchListingResult> {
    const { name, description, items, sellerWalletAddress } = dto;

    try {
      this.logger.log(
        `[START] Batch listing ${items.length} voucher types on marketplace by seller ${sellerWalletAddress}`,
      );

      // 1. Validate all vouchers exist and get their tokenIds
      this.logger.log(`[STEP 1] Validating ${items.length} vouchers`);
      const vouchers = await this.validateVouchers(items);

      // 2. Get seller wallet from database
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

      // 3. Get THB token address
      const thbAddress = this.configService.get<string>('THB_ADDRESS');
      if (!thbAddress) {
        throw new BadRequestException('THB_ADDRESS not configured');
      }

      this.logger.log(`[STEP 3] Using THB token: ${thbAddress}`);

      // 4. Check if seller is whitelisted, if not add to whitelist
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

      // 5. Calculate totals for the batch
      const totalItems = items.reduce((sum, item) => sum + item.amount, 0);
      const totalValue = items.reduce(
        (sum, item) => sum + item.amount * item.pricePerUnitTHB,
        0,
      );

      // 6. Create ListingBatch record first
      this.logger.log(`[STEP 5] Creating ListingBatch record`);
      const listingBatch = await this.prisma.listingBatch.create({
        data: {
          sellerWalletAddress: sellerWalletAddress.toLowerCase(),
          name: name || null,
          description: description || null,
          totalItems,
          soldItems: 0,
          totalValue,
          currency: 'THB',
          status: 'ACTIVE',
        },
      });

      this.logger.log(`[STEP 5] Created ListingBatch: ${listingBatch.id}`);

      // 7. Process each voucher type: mint, list on blockchain, create VoucherCodes
      const listedItems: BatchListingItem[] = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const voucher = vouchers.get(item.voucherId)!;

        this.logger.log(
          `[STEP 6.${i + 1}] Processing voucher ${voucher.name} (${item.amount} units)`,
        );

        // 7a. Mint NFT coupons to seller
        this.logger.log(
          `[STEP 6.${i + 1}a] Minting ${item.amount} NFT coupons`,
        );
        await this.blockchainService.mintCoupon(
          sellerWalletAddress,
          voucher.tokenId!,
          item.amount,
        );

        // 7b. List on marketplace
        this.logger.log(`[STEP 6.${i + 1}b] Listing on blockchain marketplace`);
        const listResult = await this.blockchainService.listCoupon(
          voucher.tokenId!,
          item.amount,
          item.pricePerUnitTHB.toString(),
          sellerWallet.privateKey,
          thbAddress,
        );

        this.logger.log(
          `[STEP 6.${i + 1}b] Listed successfully. ListingId: ${listResult.listingId}`,
        );

        // 7c. Create VoucherCode records with listingBatchId
        this.logger.log(
          `[STEP 6.${i + 1}c] Creating ${item.amount} voucher codes`,
        );

        const voucherCodes = [];
        for (let j = 0; j < item.amount; j++) {
          const code = `${voucher.tokenId}-BATCH-${listingBatch.id}-${listResult.listingId}-${j + 1}`;
          voucherCodes.push({
            code,
            voucherId: voucher.id,
            voucherGroupId: listResult.listingId, // Blockchain listing ID
            listingBatchId: listingBatch.id, // Link to batch
            pointsCost: Math.round(item.pricePerUnitTHB),
            pointId: null,
            currency: 'THB',
            isUsed: false,
            currentOwnerId: null,
          });
        }

        await this.prisma.voucherCode.createMany({
          data: voucherCodes,
        });

        listedItems.push({
          voucherId: voucher.id,
          voucherName: voucher.name,
          tokenId: voucher.tokenId!,
          listingId: listResult.listingId,
          amount: item.amount,
          pricePerUnitTHB: item.pricePerUnitTHB,
          txHash: listResult.hash,
          blockNumber: listResult.blockNumber,
        });
      }

      this.logger.log(
        `[DONE] Successfully batch listed ${items.length} voucher types with ${totalItems} total items`,
      );

      return {
        batch: {
          id: listingBatch.id,
          name: listingBatch.name,
          description: listingBatch.description,
          sellerWalletAddress: listingBatch.sellerWalletAddress,
          totalItems: listingBatch.totalItems,
          totalValue: listingBatch.totalValue,
          currency: listingBatch.currency,
          status: listingBatch.status,
        },
        items: listedItems,
        nextSteps: {
          message: `Successfully listed ${totalItems} vouchers in batch. Merchants can purchase using individual listingIds.`,
          viewListingsEndpoint: `GET /voucher/seller/listings/${listingBatch.id}`,
          merchantBuyEndpoint: 'POST /voucher/merchant/buy-from-seller',
        },
      };
    } catch (error) {
      this.logger.error(
        `[FATAL ERROR] Failed to batch list vouchers: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private async validateVouchers(
    items: { voucherId: string; amount: number }[],
  ): Promise<
    Map<
      string,
      { id: string; name: string; tokenId: string | null; totalIssued: number }
    >
  > {
    const voucherIds = items.map((item) => item.voucherId);

    const vouchers = await this.prisma.voucher.findMany({
      where: { id: { in: voucherIds } },
      select: {
        id: true,
        name: true,
        tokenId: true,
        totalIssued: true,
        merchantId: true,
      },
    });

    const voucherMap = new Map(vouchers.map((v) => [v.id, v]));

    // Validate each voucher
    for (const item of items) {
      const voucher = voucherMap.get(item.voucherId);

      if (!voucher) {
        throw new NotFoundException(`Voucher ${item.voucherId} not found`);
      }

      if (voucher.merchantId) {
        throw new BadRequestException(
          `Voucher ${voucher.name} is already assigned to a merchant. Only unassigned vouchers can be listed by sellers.`,
        );
      }

      if (!voucher.tokenId) {
        throw new BadRequestException(
          `Voucher ${voucher.name} must have a tokenId. Please mint the NFT first.`,
        );
      }

      if (item.amount > voucher.totalIssued) {
        throw new BadRequestException(
          `Cannot list ${item.amount} units of ${voucher.name}. Only ${voucher.totalIssued} available.`,
        );
      }
    }

    return voucherMap as Map<
      string,
      { id: string; name: string; tokenId: string; totalIssued: number }
    >;
  }
}
