import {
  Injectable,
  InternalServerErrorException,
  Logger,
  BadRequestException,
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
      const phoneNumber = (data as any).tel;

      // Validate: ตรวจสอบว่า userId มีอยู่จริง
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new BadRequestException(`User with ID ${userId} not found`);
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

      // ใช้ transaction เพื่อให้ rollback ทั้งหมดถ้ามีขั้นตอนใดล้มเหลว
      const result = await this.prisma.$transaction(async (tx) => {
        // 1. สร้าง wallet ก่อน
        const { privateKey } = createWallet();

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

        // 3. สร้าง merchant พร้อม walletId (ไม่ include wallet ใน response)
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

        return merchant;
      });

      // 4. สร้าง default API key (นอก transaction)
      await this.createApiKey.execute(result.id, {
        name: 'default api key',
      });

      // 5. ลบ wallet field ออกจาก response (ถ้ามี)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { wallet, ...merchantWithoutWallet } = result as any;

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
