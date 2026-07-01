import {
  Injectable,
  InternalServerErrorException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';
import { Merchant, Prisma } from '@prisma/client';
import { MerchantDBService } from '../services/merchant-db.service';
import { PrismaService } from 'prisma/prisma.service';
import { TokenService } from 'src/providers/token/token.service';
import { ConfigService } from '@nestjs/config';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';
import { deriveChildWallet } from 'src/libs/derive-wallet';

@Injectable()
export class CreateMerchant {
  private readonly logger = new Logger(CreateMerchant.name);

  constructor(
    private readonly db: MerchantDBService,
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly configService: ConfigService,
    private readonly blockchainService: BlockchainService,
  ) {}

  async execute(
    userId: string,
    data: Omit<Prisma.MerchantCreateInput, 'userMerchant'>,
  ): Promise<Merchant> {
    try {
      const phoneNumber = (data as any).tel;

      // Validate: ตรวจสอบว่า userId มีอยู่จริง และมี master wallet
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { wallet: true },
      });

      if (!user) {
        throw new BadRequestException(`User with ID ${userId} not found`);
      }

      if (!user.wallet?.seedPhrase) {
        throw new BadRequestException(
          `User ${userId} does not have a master wallet. Please re-register.`,
        );
      }

      // Validate: ตรวจสอบว่าเบอร์โทรศัพท์ซ้ำหรือไม่
      if (phoneNumber) {
        const existingWallet = await this.prisma.wallet.findFirst({
          where: {
            phoneNumber,
            type: 'merchant',
          },
        });

        if (existingWallet) {
          throw new BadRequestException(
            `Phone number ${phoneNumber} is already registered`,
          );
        }
      }

      // Decrypt master seedPhrase
      this.logger.log(`[CreateMerchant] Decrypting master seedPhrase`);
      const salt = this.configService.get<string>('SALT');
      const masterSeedPhrase = this.tokenService.decryptKey(
        salt,
        user.wallet.seedPhrase,
      );

      // Get derivation indices from user
      const merchantIndex = user.nextDerivationIndex;
      const sellerIndex = user.nextDerivationIndex + 1;
      this.logger.log(
        `[CreateMerchant] Deriving wallets: merchant(index=${merchantIndex}), seller(index=${sellerIndex})`,
      );

      // ใช้ transaction เพื่อให้ rollback ทั้งหมดถ้ามีขั้นตอนใดล้มเหลว
      let walletAddress: string;
      const result = await this.prisma.$transaction(async (tx) => {
        // 1. Derive merchant wallet from master seedPhrase
        const merchantWalletData = deriveChildWallet(
          masterSeedPhrase,
          merchantIndex,
        );
        walletAddress = merchantWalletData.address.toLowerCase();

        // 2. Encrypt child-specific chainCode (each child has its own chainCode)
        const encryptedSeedPhrase = user.wallet.seedPhrase; // seedPhrase เดิม
        const encryptedMerchantChainCode = this.tokenService.encryptKey(
          salt,
          merchantWalletData.chainCode, // chainCode ของ merchant child
        );
        this.logger.log(`[CreateMerchant] Encrypted merchant child chainCode`);

        // 3. สร้าง merchant wallet record ใน database
        const wallet = await tx.wallet.create({
          data: {
            walletAddress,
            seedPhrase: encryptedSeedPhrase,
            chainCode: encryptedMerchantChainCode, // ใช้ chainCode ของ child
            derivationIndex: merchantIndex,
            email: '', // merchant ไม่มี email
            phoneNumber: (data as any).tel || '',
            type: 'merchant',
            status: 'active',
          },
        });
        this.logger.log(
          `[CreateMerchant] ✅ Merchant wallet created: ${walletAddress}`,
        );

        // 3.5. Derive seller wallet from master seedPhrase
        const sellerWalletData = deriveChildWallet(
          masterSeedPhrase,
          sellerIndex,
        );
        const encryptedSellerChainCode = this.tokenService.encryptKey(
          salt,
          sellerWalletData.chainCode, // chainCode ของ seller child
        );

        const sellerWallet = await tx.wallet.create({
          data: {
            walletAddress: sellerWalletData.address.toLowerCase(),
            seedPhrase: encryptedSeedPhrase, // ใช้ seed เดิม (encrypted)
            chainCode: encryptedSellerChainCode, // ใช้ chainCode ของ child
            derivationIndex: sellerIndex,
            email: '',
            phoneNumber: (data as any).tel || '',
            type: 'seller',
            status: 'active',
          },
        });
        this.logger.log(
          `[CreateMerchant] ✅ Seller wallet created: ${sellerWallet.walletAddress}`,
        );

        // 4. Update user's nextDerivationIndex
        await tx.user.update({
          where: { id: userId },
          data: { nextDerivationIndex: sellerIndex + 1 },
        });
        this.logger.log(
          `[CreateMerchant] ✅ User nextDerivationIndex updated to ${sellerIndex + 1}`,
        );

        // 5. สร้าง merchant พร้อม walletId (ไม่ include wallet ใน response)
        const merchant = await tx.merchant.create({
          data: {
            ...(data as any),
            walletId: wallet.id,
            userMerchant: {
              create: {
                userId,
              },
            },
          },
        });

        const generatedApiKey = await this.tokenService.generateRandomString(
          {},
        );
        await tx.apiKey.create({
          data: {
            name: 'default api key',
            apiKey: generatedApiKey,
            merchantId: merchant.id,
          },
        });

        return { merchant, sellerWalletAddress: sellerWallet.walletAddress };
      });

      // 5.5. Auto-whitelist merchant & seller wallet addresses on marketplace
      try {
        // Whitelist merchant wallet
        this.logger.log(
          `[CreateMerchant] Auto-whitelisting merchant wallet: ${walletAddress}`,
        );
        const isMerchantWhitelisted =
          await this.blockchainService.isWhitelisted(walletAddress);

        if (!isMerchantWhitelisted) {
          await this.blockchainService.addToMarketplaceWhitelist(walletAddress);
          this.logger.log(
            `[CreateMerchant] ✅ Merchant wallet whitelisted successfully`,
          );
        } else {
          this.logger.log(
            `[CreateMerchant] ℹ️ Merchant wallet already whitelisted`,
          );
        }

        // Whitelist seller wallet
        this.logger.log(
          `[CreateMerchant] Auto-whitelisting seller wallet: ${result.sellerWalletAddress}`,
        );
        const isSellerWhitelisted = await this.blockchainService.isWhitelisted(
          result.sellerWalletAddress,
        );

        if (!isSellerWhitelisted) {
          await this.blockchainService.addToMarketplaceWhitelist(
            result.sellerWalletAddress,
          );
          this.logger.log(
            `[CreateMerchant] ✅ Seller wallet whitelisted successfully`,
          );
        } else {
          this.logger.log(
            `[CreateMerchant] ℹ️ Seller wallet already whitelisted`,
          );
        }
      } catch (whitelistError) {
        // Non-critical: ไม่ throw error เพราะ merchant สร้างสำเร็จแล้ว
        // Merchant สามารถ whitelist ได้ทีหลังผ่าน manual API หรือ auto-whitelist ตอนทำ transaction ครั้งแรก
        this.logger.warn(
          `[CreateMerchant] ⚠️ Failed to auto-whitelist: ${whitelistError.message}`,
        );
        this.logger.warn(
          `[CreateMerchant] Wallets can be whitelisted manually later or will be auto-whitelisted on first transaction`,
        );
      }

      // 6. ลบ wallet field ออกจาก response (ถ้ามี)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { wallet, ...merchantWithoutWallet } = result.merchant as any;

      return merchantWithoutWallet as Merchant;
    } catch (error) {
      this.logger.error(
        `Error message : ${error.message}, \n Error detail : ${error}`,
      );

      // Re-throw BadRequestException เพื่อให้ส่ง status 400 ไปหน้าบ้าน
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }
}
