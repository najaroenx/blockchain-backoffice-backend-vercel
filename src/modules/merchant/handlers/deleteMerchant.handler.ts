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
import { Merchant } from '@prisma/client';
import { MerchantDBService } from '../services/merchant-db.service';

@Injectable()
export class DeleteMerchant {
  private logger = new Logger(DeleteMerchant.name);

  constructor(private db: MerchantDBService) {}

  async execute(id: string): Promise<Merchant> {
    try {
      const findMerchant = await this.db.getMerchantById(id);

      if (!findMerchant) throw new NotFoundException(MERCHANT_NOT_FOUND);

      const merchant = await this.db.deleteMerchant(id);

      return merchant;
    } catch (error) {
      this.logger.error(
        `Error message : ${error.message}, \n Error detail : ${error}`,
      );
      if (error instanceof NotFoundException) {
        throw error;
      } else {
        throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
      }
    }
  }
}
