import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';
import { Merchant, Prisma } from '@prisma/client';
import { MerchantDBService } from '../services/merchant-db.service';
import { CreateApiKey } from 'src/modules/api-key/handlers/createApiKey.handler';
import { PrismaService } from 'prisma/prisma.service';
import { createWallet } from 'src/libs/createWallet';

@Injectable()
export class CreateMerchant {
  private logger = new Logger(CreateMerchant.name);

  constructor(
    private db: MerchantDBService,
    private createApiKey: CreateApiKey,
    private prisma: PrismaService,
  ) {}

  async execute(
    userId: string,
    data: Omit<Prisma.MerchantCreateInput, 'userMerchant'>,
  ): Promise<Merchant> {
    try {
      // ใช้ transaction เพื่อให้ rollback ทั้งหมดถ้ามีขั้นตอนใดล้มเหลว
      const result = await this.prisma.$transaction(async (tx) => {
        // 1. สร้าง wallet ก่อน
        const { walletAddress, privateKey } = createWallet();

        // 2. สร้าง wallet record ใน database
        const wallet = await tx.wallet.create({
          data: {
            privateKey,
            email: '', // merchant ไม่มี email
            phoneNumber: (data as any).tel || '',
            type: 'merchant',
            status: 'active',
          },
        });

        // 3. สร้าง merchant พร้อม walletId
        const { wallet: _, ...merchantDataWithoutWallet } = data as any;
        const merchant = await tx.merchant.create({
          data: {
            ...merchantDataWithoutWallet,
            walletId: wallet.id,
            userMerchant: {
              create: {
                userId,
              },
            },
          },
        });

        return merchant;
      });

      // 4. สร้าง default API key (นอก transaction)
      await this.createApiKey.execute(result.id, {
        name: 'default api key',
      });

      return result;
    } catch (error) {
      this.logger.error(
        `Error message : ${error.message}, \n Error detail : ${error}`,
      );

      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }
}
