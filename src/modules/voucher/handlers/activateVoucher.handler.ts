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

      if (point.merchantId !== upcomingVoucher.merchantId) {
        this.logger.error(
          `[ERROR] Point belongs to different merchant. Point merchantId: ${point.merchantId}, Voucher merchantId: ${upcomingVoucher.merchantId}`,
        );
        throw new BadRequestException(
          `Point does not belong to this voucher's merchant`,
        );
      }

      this.logger.log(
        `[STEP 1.5] Point validated ✓ (${point.name}, symbol: ${point.symbol})`,
      );

      // 2. นับจำนวน codes ที่มีอยู่แล้ว (codes ที่มี voucherGroupId)
      this.logger.log(`[STEP 2] Counting existing codes`);
      const activeCodesCount = await this.prisma.voucherCode.count({
        where: { voucherId, voucherGroupId: { not: null } },
      });

      this.logger.log(
        `[STEP 2] Current state: ${activeCodesCount} active codes, ${upcomingVoucher.totalIssued} remaining (upcoming)`,
      );

      // 3. ตรวจสอบว่า amount ไม่เกิน totalIssued ที่เหลือ
      this.logger.log(
        `[STEP 3] Validating amount ${amount} <= remaining totalIssued ${upcomingVoucher.totalIssued}`,
      );

      if (amount > upcomingVoucher.totalIssued) {
        this.logger.error(
          `[ERROR] Amount ${amount} exceeds remaining totalIssued ${upcomingVoucher.totalIssued}`,
        );
        throw new BadRequestException(
          `Cannot activate ${amount} codes. Only ${upcomingVoucher.totalIssued} remaining to be activated.`,
        );
      }

      // 4. ใช้ transaction เพื่อสร้าง codes และอัพเดท isActive
      this.logger.log(`[STEP 4] Starting transaction`);
      const result = await this.prisma.$transaction(
        async (tx) => {
          // 4.1 นับจำนวน codes ที่มีอยู่แล้วเพื่อเป็น starting number
          const existingCodesCount = await tx.voucherCode.count({
            where: { voucherId },
          });

          // 4.2 สร้าง sequential codes: voucherId-0001, voucherId-0002, ...
          this.logger.log(
            `[STEP 4.1] Generating ${amount} sequential codes starting from ${existingCodesCount + 1}`,
          );
          const codes: string[] = [];
          for (let i = 1; i <= amount; i++) {
            const sequenceNumber = existingCodesCount + i;
            const code = `${voucherId}-${sequenceNumber.toString().padStart(4, '0')}`;
            codes.push(code);
          }

          // 4.3 implement code smart contract here trigger (future)

          // Get merchant wallet for blockchain operations
          const merchant = await tx.merchant.findUnique({
            where: { id: upcomingVoucher.merchantId },
            include: { wallet: true },
          });

          if (
            !merchant?.wallet?.walletAddress ||
            !merchant?.wallet?.privateKey
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

          // Decrypt merchant private key before blockchain operations
          const salt = this.configService.get<string>('SALT');
          const decryptedPrivateKey = this.tokenService.decryptKey(
            salt,
            merchant.wallet.privateKey,
          );

          if (!decryptedPrivateKey) {
            throw new Error('Failed to decrypt merchant private key');
          }

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

          // Skip Step 4.3.2 - Do not lock escrow automatically
          // Listing will remain active for customers to purchase from marketplace
          // Escrow will be created when customers buy via buyCoupon()
          this.logger.log(
            `[STEP 4.3.2] Skipping automatic escrow lock - listing remains active for customer purchases`,
          );

          // 4.4 Create voucher codes with listingId as voucherGroupId
          this.logger.log(
            `[STEP 4.4] Creating ${amount} active voucher codes with listingId: ${listingId}`,
          );
          const chunkSize = 100;
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
              })),
            });
          }
          this.logger.log(
            `[STEP 4.4] Created ${amount} codes with voucherGroupId (listingId): ${listingId}`,
          );

          // 4.5 ลด totalIssued ของ voucher
          const newTotalIssued = upcomingVoucher.totalIssued - amount;
          this.logger.log(
            `[STEP 4.6] Updating voucher: totalIssued ${upcomingVoucher.totalIssued} -> ${newTotalIssued}`,
          );

          await tx.voucher.update({
            where: { id: voucherId },
            data: {
              totalIssued: newTotalIssued,
            },
          });

          // 4.6 นับจำนวน codes ตามสถานะ (codes ที่มี voucherGroupId)
          const activeCodesCount = await tx.voucherCode.count({
            where: { voucherId, voucherGroupId: { not: null } },
          });

          this.logger.log(
            `[STEP 4.7] Active codes: ${activeCodesCount}, Upcoming: ${newTotalIssued}`,
          );

          return {
            voucherId,
            codesCreated: amount,
            activeCodesCount,
            upcomingCodesCount: newTotalIssued,
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
