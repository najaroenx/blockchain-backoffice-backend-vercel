import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { MerchantRepository } from './merchant.repository';
import { Merchant, Prisma } from '@prisma/client';
import {
  INTERNAL_SERVER_ERROR,
  MERCHANT_NOT_FOUND,
} from 'src/errors/error.constants';
import { ApiKeyService } from '../api-key/api-key.service';

@Injectable()
export class MerchantService {
  constructor(
    private repository: MerchantRepository,
    private apiKeyService: ApiKeyService,
  ) {}

  async getMerchants(
    userId: string,
  ): Promise<{ merchants: Merchant[]; counts: number }> {
    try {
      const merchants: Merchant[] = await this.repository.findMany({
        where: {
          userMerchant: {
            some: {
              userId,
            },
          },
        },
      });

      if (!merchants) throw new NotFoundException(MERCHANT_NOT_FOUND);

      return {
        merchants,
        counts: merchants.length,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      } else {
        throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
      }
    }
  }

  async createMerchant(
    userId: string,
    data: Omit<Prisma.MerchantCreateInput, 'userMerchant'>,
  ): Promise<Merchant> {
    try {
      const merchant: Merchant = await this.repository.create({
        data: {
          ...data,
          userMerchant: {
            create: {
              userId,
            },
          },
        },
      });

      await this.apiKeyService.createApiKey(merchant.id, {
        name: 'default api key',
      });

      return merchant;
    } catch (error) {
      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }
}
