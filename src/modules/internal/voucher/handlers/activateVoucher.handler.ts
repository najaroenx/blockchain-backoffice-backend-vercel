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
import { convertBufferToAddress } from 'src/libs/convertBufferToAddress';
import { getSignerFromSeedPhrase } from 'src/libs/derive-wallet';

@Injectable()
export class ActivateVoucher {
  private logger = new Logger(ActivateVoucher.name);

  constructor(
    private prisma: PrismaService,
    private blockchainService: BlockchainService,
    private tokenService: TokenService,
    private configService: ConfigService,
  ) {}

  async execute(
    voucherId: string,
    amount: number,
    pointsCost: number,
    pointId: string,
  ) {
    try {
      this.logger.log(
        `[START] Activating voucher ${voucherId} with amount: ${amount}, pointsCost: ${pointsCost}, pointId: ${pointId}`,
      );

      // 1. ตรวจสอบว่า voucher upstream มีอยู่จริง
      this.logger.log(`[STEP 1] Finding upcoming voucher ${voucherId}`);
      const upcomingVoucher = await this.prisma.voucher.findUnique({
        where: { id: voucherId },
        include: {
          _count: {
            select: { voucherCodes: true },
          },
        },
      });

      this.logger.log(
        `[STEP 1] Found voucher: ${JSON.stringify({ id: upcomingVoucher?.id, status: upcomingVoucher?.status, totalIssued: upcomingVoucher?.totalIssued, codesCount: upcomingVoucher?._count.voucherCodes })}`,
      );

      if (!upcomingVoucher) {
        this.logger.error(`[ERROR] Voucher ${voucherId} not found`);
        throw new NotFoundException(`Voucher with ID ${voucherId} not found`);
      }

      // 1.5. Validate Point exists and belongs to merchant
      this.logger.log(`[STEP 1.5] Validating point ${pointId}`);
      const point = await this.prisma.point.findUnique({
        where: { id: pointId },
        select: {
          id: true,
          symbol: true,
          merchantId: true,
          name: true,
          contractAddress: true,
        },
      });

      if (!point) {
        this.logger.error(`[ERROR] Point ${pointId} not found`);
        throw new NotFoundException(`Point with ID ${pointId} not found`);
      }

      // Check merchant access: either owns the voucher OR owns codes in the voucher
      const isVoucherOwner = point.merchantId === upcomingVoucher.merchantId;

      // Count codes owned by this merchant (purchased from seller) that are not yet activated
      const ownedCodesCount = await this.prisma.voucherCode.count({
        where: {
          voucherId: voucherId,
          currentOwnerId: point.merchantId,
          currentOwnerType: 'MERCHANT',
          pointId: null, // Only count codes not yet activated
        },
      });

      const hasOwnedCodes = ownedCodesCount > 0;

      this.logger.log(
        `[STEP 1.5] Access check - isVoucherOwner: ${isVoucherOwner}, ownedCodesCount: ${ownedCodesCount}`,
      );

      if (!isVoucherOwner && !hasOwnedCodes) {
        this.logger.error(
          `[ERROR] Merchant ${point.merchantId} does not have access to voucher ${voucherId}. ` +
            `Voucher merchantId: ${upcomingVoucher.merchantId}, owned codes: ${ownedCodesCount}`,
        );
        throw new BadRequestException(
          `Merchant does not have access to this voucher. Either own the voucher or purchase codes from seller first.`,
        );
      }

      // Determine if this is a seller voucher (merchant purchased codes)
      const isSellerVoucher = !isVoucherOwner && hasOwnedCodes;

      this.logger.log(
        `[STEP 1.5] Point validated ✓ (${point.name}, symbol: ${point.symbol}). isSellerVoucher: ${isSellerVoucher}`,
      );

      // 2. นับจำนวน codes ที่มีอยู่แล้ว (codes ที่มี voucherGroupId)
      this.logger.log(`[STEP 2] Counting existing codes`);
      const activeCodesCount = await this.prisma.voucherCode.count({
        where: { voucherId, voucherGroupId: { not: null } },
      });

      this.logger.log(
        `[STEP 2] Current state: ${activeCodesCount} active codes, ${upcomingVoucher.totalIssued} remaining (upcoming)`,
      );

      // 3. ตรวจสอบว่า amount ไม่เกินจำนวนที่สามารถ activate ได้
      this.logger.log(`[STEP 3] Validating amount`);

      // For seller voucher: limit by owned codes count
      // For own voucher: limit by totalIssued
      const availableToActivate = isSellerVoucher
        ? ownedCodesCount
        : upcomingVoucher.totalIssued;

      this.logger.log(
        `[STEP 3] isSellerVoucher: ${isSellerVoucher}, availableToActivate: ${availableToActivate}, requested: ${amount}`,
      );

      if (amount > availableToActivate) {
        if (isSellerVoucher) {
          this.logger.error(
            `[ERROR] Amount ${amount} exceeds owned codes ${ownedCodesCount}`,
          );
          throw new BadRequestException(
            `Cannot activate ${amount} codes. You own ${ownedCodesCount} unactivated codes from this voucher.`,
          );
        } else {
          this.logger.error(
            `[ERROR] Amount ${amount} exceeds remaining totalIssued ${upcomingVoucher.totalIssued}`,
          );
          throw new BadRequestException(
            `Cannot activate ${amount} codes. Only ${upcomingVoucher.totalIssued} remaining to be activated.`,
          );
        }
      }

      // 4. ใช้ transaction เพื่อสร้าง/อัพเดท codes และอัพเดท isActive
      this.logger.log(
        `[STEP 4] Starting transaction (isSellerVoucher: ${isSellerVoucher})`,
      );
      const result = await this.prisma.$transaction(
        async (tx) => {
          // Get the actual merchant who is activating (from point ownership)
          const activatingMerchantId = point.merchantId;

          // For seller vouchers: get existing codes to activate
          // For own vouchers: generate new codes
          let codesToActivate: { id: string; code: string }[] = [];

          if (isSellerVoucher) {
            // Get owned codes that are not yet activated
            this.logger.log(
              `[STEP 4.1] Fetching ${amount} owned codes to activate for merchant ${activatingMerchantId}`,
            );
            codesToActivate = await tx.voucherCode.findMany({
              where: {
                voucherId,
                currentOwnerId: activatingMerchantId,
                currentOwnerType: 'MERCHANT',
                pointId: null, // Only get codes not yet activated
              },
              select: { id: true, code: true },
              take: amount,
            });

            this.logger.log(
              `[STEP 4.1] Found ${codesToActivate.length} codes to activate`,
            );
          } else {
            // 4.1 นับจำนวน codes ที่มีอยู่แล้วเพื่อเป็น starting number
            const existingCodesCount = await tx.voucherCode.count({
              where: { voucherId },
            });

            // 4.2 สร้าง sequential codes: voucherId-0001, voucherId-0002, ...
            this.logger.log(
              `[STEP 4.1] Generating ${amount} sequential codes starting from ${existingCodesCount + 1}`,
            );
            for (let i = 1; i <= amount; i++) {
              const sequenceNumber = existingCodesCount + i;
              const code = `${voucherId}-${sequenceNumber.toString().padStart(4, '0')}`;
              codesToActivate.push({ id: '', code }); // id will be set after creation
            }
          }

          // Get merchant wallet for blockchain operations (use activating merchant, not voucher owner)
          const merchant = await tx.merchant.findUnique({
            where: { id: activatingMerchantId },
            include: { wallet: true },
          });

          if (
            !merchant?.wallet?.walletAddress ||
            !merchant?.wallet?.seedPhrase
          ) {
            throw new Error('Merchant wallet not configured');
          }

          // Get tokenId from voucher
          if (!upcomingVoucher.tokenId) {
            throw new Error(
              'Voucher does not have tokenId. Please create voucher with blockchain integration first.',
            );
          }

          // 4.2 Check merchant NFT balance (merchant already owns NFTs from purchase)
          this.logger.log(
            `[STEP 4.2] Checking merchant NFT balance for typeId ${upcomingVoucher.tokenId}`,
          );

          try {
            const merchantNFTBalance =
              await this.blockchainService.getUserCouponBalance(
                merchant.wallet.walletAddress,
                parseInt(upcomingVoucher.tokenId),
              );

            this.logger.log(
              `[STEP 4.2] Merchant NFT balance: ${merchantNFTBalance.balance} (activating ${amount})`,
            );

            if (parseInt(merchantNFTBalance.balance) < amount) {
              this.logger.error(
                `[ERROR] Insufficient NFT balance. Required: ${amount}, Available: ${merchantNFTBalance.balance}`,
              );
              throw new BadRequestException(
                `Merchant has insufficient NFT balance. Required: ${amount}, Available: ${merchantNFTBalance.balance}. ` +
                  `Please ensure merchant has purchased enough vouchers from seller first.`,
              );
            }

            this.logger.log(`[STEP 4.2] Merchant has sufficient NFT balance ✓`);
          } catch (error) {
            this.logger.error(
              `[ERROR] Failed to check NFT balance: ${error.message}`,
            );
            throw new BadRequestException(
              `Failed to verify merchant NFT balance: ${error.message}`,
            );
          }

          // 4.2.5 ตรวจสอบและ whitelist merchant ใน marketplace
          this.logger.log(
            `[STEP 4.2.5] Checking marketplace whitelist for merchant wallet`,
          );
          const isWhitelisted = await this.blockchainService.isWhitelisted(
            merchant.wallet.walletAddress,
          );

          if (!isWhitelisted) {
            this.logger.log(
              `[STEP 4.2.5] Merchant ยังไม่ได้ whitelist กำลังเพิ่มเข้า whitelist...`,
            );
            await this.blockchainService.addToMarketplaceWhitelist(
              merchant.wallet.walletAddress,
            );
            this.logger.log(`[STEP 4.2.5] Merchant whitelist สำเร็จ ✓`);
          } else {
            this.logger.log(`[STEP 4.2.5] Merchant ถูก whitelist แล้ว ✓`);
          }

          // 4.3 List on marketplace
          this.logger.log(
            `[STEP 4.3] Listing ${amount} coupons on marketplace at price ${pointsCost} per unit`,
          );

          // Decrypt merchant seed phrase and derive private key
          const salt = this.configService.get<string>('SALT');
          const decryptedSeedPhrase = this.tokenService.decryptKey(
            salt,
            merchant.wallet.seedPhrase,
          );

          if (!decryptedSeedPhrase) {
            throw new Error('Failed to decrypt merchant seed phrase');
          }

          // Derive private key from seed phrase
          const merchantSigner = getSignerFromSeedPhrase(
            decryptedSeedPhrase,
            merchant.wallet.derivationIndex || 0,
          );
          const decryptedPrivateKey = merchantSigner.privateKey;

          // Get point token address for payment token
          const pointTokenAddress = convertBufferToAddress(
            point.contractAddress as any,
          );

          this.logger.log(
            `[STEP 4.3] Using point token ${pointTokenAddress} as payment token`,
          );

          const listResult = await this.blockchainService.listCoupon(
            upcomingVoucher.tokenId,
            amount,
            pointsCost.toString(),
            decryptedPrivateKey,
            pointTokenAddress, // Customer pays with point token
          );

          const listingId = listResult.listingId;

          this.logger.log(
            `[STEP 4.3] Listed on marketplace with listingId: ${listingId}`,
          );

          // 4.3.1 Verify listing is active before proceeding
          this.logger.log(
            `[STEP 4.3.1] Verifying listing ${listingId} is active...`,
          );

          // Wait briefly for blockchain state to sync
          await new Promise((resolve) => setTimeout(resolve, 2000));

          const listing =
            await this.blockchainService.getMarketplaceListing(listingId);

          this.logger.log(
            `[STEP 4.3.1] Listing details: ${JSON.stringify({
              listingId,
              isActive: listing.isActive,
              seller: listing.seller,
              amount: listing.amount,
              typeId: listing.typeId,
              pricePerUnit: listing.pricePerUnit,
            })}`,
          );

          if (!listing.isActive) {
            this.logger.error(
              `[ERROR] Listing ${listingId} is not active. Full listing: ${JSON.stringify(listing)}`,
            );
            throw new Error(
              `Listing ${listingId} was created but is not active. Please verify merchant has sufficient coupon balance and approval.`,
            );
          }

          this.logger.log(`[STEP 4.3.1] Listing verified as active ✓`);

          // 4.3.2 Create ListingBatch record to group voucher codes for this merchant listing
          this.logger.log(
            `[STEP 4.3.2] Creating ListingBatch for merchant wallet ${merchant.wallet.walletAddress}`,
          );
          const listingBatch = await tx.listingBatch.create({
            data: {
              sellerWalletAddress: merchant.wallet.walletAddress.toLowerCase(),
              name: `merchant listing: ${merchant.wallet.walletAddress}`,
              description: null,
              totalItems: amount,
              soldItems: 0,
              totalValue: pointsCost * amount,
              currency: point.symbol,
              status: 'ACTIVE',
            },
          });
          this.logger.log(
            `[STEP 4.3.2] Created ListingBatch ${listingBatch.id} ✓`,
          );

          // 4.4 Create or update voucher codes with listingId as voucherGroupId
          if (isSellerVoucher) {
            // Update existing codes owned by merchant
            this.logger.log(
              `[STEP 4.4] Updating ${codesToActivate.length} owned voucher codes with listingId: ${listingId}`,
            );

            const codeIds = codesToActivate.map((c) => c.id);
            await tx.voucherCode.updateMany({
              where: { id: { in: codeIds } },
              data: {
                pointsCost,
                pointId,
                currency: point.symbol,
                voucherGroupId: listingId,
                listingBatchId: listingBatch.id,
              },
            });

            this.logger.log(
              `[STEP 4.4] Updated ${codesToActivate.length} codes with voucherGroupId (listingId): ${listingId}`,
            );
          } else {
            // Create new codes
            this.logger.log(
              `[STEP 4.4] Creating ${amount} active voucher codes with listingId: ${listingId}`,
            );
            const chunkSize = 100;
            const codes = codesToActivate.map((c) => c.code);
            for (let i = 0; i < codes.length; i += chunkSize) {
              const chunk = codes.slice(i, i + chunkSize);

              await tx.voucherCode.createMany({
                data: chunk.map((code) => ({
                  code,
                  voucherId,
                  pointsCost,
                  pointId,
                  currency: point.symbol,
                  voucherGroupId: listingId,
                  listingBatchId: listingBatch.id,
                })),
              });
            }
            this.logger.log(
              `[STEP 4.4] Created ${amount} codes with voucherGroupId (listingId): ${listingId}`,
            );
          }

          // 4.5 ลด totalIssued ของ voucher และ update currency (only for own vouchers)
          let newTotalIssued = upcomingVoucher.totalIssued;
          if (!isSellerVoucher) {
            newTotalIssued = upcomingVoucher.totalIssued - amount;
            this.logger.log(
              `[STEP 4.5] Updating voucher: totalIssued ${upcomingVoucher.totalIssued} -> ${newTotalIssued}, currency -> ${point.symbol}`,
            );

            await tx.voucher.update({
              where: { id: voucherId },
              data: {
                totalIssued: newTotalIssued,
                currency: point.symbol,
              },
            });
          } else {
            this.logger.log(
              `[STEP 4.5] Seller voucher - skipping totalIssued update (remains ${upcomingVoucher.totalIssued})`,
            );
          }

          // 4.6 นับจำนวน codes ตามสถานะ
          // For seller vouchers: count codes owned by this merchant with voucherGroupId
          // For own vouchers: count all codes with voucherGroupId
          const activeCodesCountQuery = isSellerVoucher
            ? {
                voucherId,
                currentOwnerId: activatingMerchantId,
                currentOwnerType: 'MERCHANT' as const,
                voucherGroupId: { not: null },
              }
            : { voucherId, voucherGroupId: { not: null } };

          const activeCodesCount = await tx.voucherCode.count({
            where: activeCodesCountQuery,
          });

          // For seller vouchers: upcoming = remaining owned codes not in this batch
          const upcomingCodesCount = isSellerVoucher
            ? ownedCodesCount - amount
            : newTotalIssued;

          this.logger.log(
            `[STEP 4.6] Active codes: ${activeCodesCount}, Upcoming: ${upcomingCodesCount}`,
          );

          return {
            voucherId,
            codesCreated: amount,
            activeCodesCount,
            upcomingCodesCount,
            isSellerVoucher,
            listingId,
            listingBatchId: listingBatch.id,
          };
        },
        {
          timeout: 120000, // extend interactive transaction timeout to handle blockchain + DB work
        },
      );

      this.logger.log(
        `[SUCCESS] Activated ${amount} codes for voucher ${voucherId}. Active: ${result.activeCodesCount}, Upcoming: ${result.upcomingCodesCount}`,
      );

      return {
        success: true,
        message: `Activated ${amount} codes successfully. Active: ${result.activeCodesCount}, Upcoming: ${result.upcomingCodesCount}`,
        voucherId: result.voucherId,
        codesCreated: result.codesCreated,
        activeCodesCount: result.activeCodesCount,
        upcomingCodesCount: result.upcomingCodesCount,
        pointsCost,
        pointId,
        currency: point.symbol,
        listingId: result.listingId,
        listingBatchId: result.listingBatchId,
      };
    } catch (error) {
      this.logger.error(
        `[FATAL ERROR] Failed to activate voucher: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
