import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';
import { Merchant, Prisma } from '@prisma/client';
import { MerchantDBService } from '../services/merchant-db.service';
import { CreateApiKey } from 'src/modules/api-key/handlers/createApiKey.handler';

@Injectable()
export class CreateMerchant {
  private logger = new Logger(CreateMerchant.name);

  constructor(
    private db: MerchantDBService,
    private createApiKey: CreateApiKey,
  ) {}

  async execute(
    userId: string,
    data: Omit<Prisma.MerchantCreateInput, 'userMerchant'>,
  ): Promise<Merchant> {
    try {
      const merchant = await this.db.createMerchant(userId, data);

      await this.createApiKey.execute(merchant.id, {
        name: 'default api key',
      });

      return merchant;
    } catch (error) {
      this.logger.error(
        `Error message : ${error.message}, \n Error detail : ${error}`,
      );

      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }
}
