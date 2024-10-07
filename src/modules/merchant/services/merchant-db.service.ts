import { Injectable } from '@nestjs/common';
import { MerchantRepository } from '../merchant.repository';
import { Merchant, Prisma } from '@prisma/client';

@Injectable()
export class MerchantDBService {
  constructor(private readonly repository: MerchantRepository) {}

  async getMerchants(userId: string): Promise<Merchant[]> {
    const merchants = await this.repository.findMany<Merchant>({
      where: {
        userMerchant: {
          some: {
            userId,
          },
        },
      },
    });

    return merchants;
  }

  async createMerchant(
    userId: string,
    data: Omit<Prisma.MerchantCreateInput, 'userMerchant'>,
  ): Promise<Merchant> {
    const merchant = await this.repository.create<Merchant>({
      data: {
        ...data,
        userMerchant: {
          create: {
            userId,
          },
        },
      },
    });

    return merchant;
  }
}
