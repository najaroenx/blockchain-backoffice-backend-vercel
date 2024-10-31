import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  INTERNAL_SERVER_ERROR,
  MERCHANT_NOT_FOUND,
} from 'src/errors/error.constants';
import { Merchant, Prisma } from '@prisma/client';
import { MerchantDBService } from '../services/merchant-db.service';

@Injectable()
export class UpdateMerchant {
  private logger = new Logger(UpdateMerchant.name);

  constructor(private db: MerchantDBService) {}

  async execute(
    merchantId: string,
    data: Prisma.MerchantUpdateInput,
  ): Promise<Merchant> {
    try {
      const merchant = await this.db.updateMerchant(merchantId, {
        ...data,
      });

      return merchant;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundException(MERCHANT_NOT_FOUND);
        }
      } else {
        this.logger.error(
          `Error message : ${error.message}, \n Error detail : ${error}`,
        );
        throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
      }
    }
  }
}
