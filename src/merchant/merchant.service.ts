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
      const { merchants, counts } = await this.repository.getMerchants(userId);

      if (!merchants && !counts) throw new NotFoundException('data_not_found');

      return {
        merchants,
        counts,
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
    lineOfficialId,
  }: {
    name: string;
    website: string;
    userId: string;
    lineOfficialId?: string;
  }): Promise<Merchant> {
    try {
      const merchant = await this.repository.createMerchant({
        name,
        website,
        userId,
        lineOfficialId,
      });

      return merchant;
    } catch (error) {
      throw new InternalServerErrorException('server_error');
    }
  }
}
