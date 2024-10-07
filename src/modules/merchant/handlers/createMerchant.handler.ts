import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';
import { Merchant, Prisma } from '@prisma/client';
import { MerchantDBService } from '../services/merchant-db.service';
import { CreateApiKey } from 'src/modules/api-key/handlers/createApiKey.handler';

@Injectable()
export class CreateMerchant {
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
      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }
}
