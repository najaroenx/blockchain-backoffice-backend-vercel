import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { MerchantRepository } from './merchant.repository';
import { Merchant } from '@prisma/client';

@Injectable()
export class MerchantService {
  constructor(private repository: MerchantRepository) {}

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

      if (!merchants) throw new NotFoundException('data_not_found');

      return {
        merchants,
        counts: merchants.length,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      } else {
        throw new InternalServerErrorException('server_error');
      }
    }
  }

  async createMerchant({
    name,
    website,
    userId,
  }: {
    name: string;
    website: string;
    userId: string;
  }): Promise<Merchant> {
    try {
      const merchant = await this.repository.create({
        data: {
          name,
          website,
          userMerchant: {
            create: {
              userId,
            },
          },
        },
      });

      return merchant;
    } catch (error) {
      throw new InternalServerErrorException('server_error');
    }
  }
}
