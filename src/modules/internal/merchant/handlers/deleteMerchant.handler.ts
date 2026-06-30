import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { MERCHANT_NOT_FOUND } from 'src/errors/error.constants';
import { MerchantDBService } from '../services/merchant-db.service';
import { PrismaService } from 'prisma/prisma.service';
import { logAndRethrowOrInternalError } from 'src/common/utils/handler-error.util';

@Injectable()
export class DeleteMerchant {
  private logger = new Logger(DeleteMerchant.name);

  constructor(
    private db: MerchantDBService,
    private prisma: PrismaService,
  ) {}

  async execute(id: string): Promise<any> {
    try {
      const findMerchant = await this.db.getMerchantById(id);

      if (!findMerchant) throw new NotFoundException(MERCHANT_NOT_FOUND);

      // ใช้ transaction เพื่อลบทั้ง merchant และ wallet
      const result = await this.prisma.$transaction(async (tx) => {
        // ลบ merchant ก่อน (cascade จะลบ userMerchant, points, etc.)
        const deletedMerchant = await tx.merchant.delete({
          where: { id },
        });

        // ลบ wallet ถ้ามี
        if (findMerchant.walletId) {
          await tx.wallet.delete({
            where: { id: findMerchant.walletId },
          });
        }

        return deletedMerchant;
      });

      this.logger.log(`Deleted merchant ${id} and associated wallet`);

      return {
        success: true,
        message: 'Merchant and wallet deleted successfully',
        merchant: result,
      };
    } catch (error) {
      logAndRethrowOrInternalError(this.logger, error, [NotFoundException]);
    }
  }
}
