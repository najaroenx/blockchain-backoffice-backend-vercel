import { Injectable } from '@nestjs/common';
import { MerchantRepository } from '../merchant.repository';
import { Merchant, Prisma } from '@prisma/client';

@Injectable()
export class MerchantDBService {
  constructor(private readonly repository: MerchantRepository) {}

  async getMerchants(userId: string): Promise<any[]> {
    // refactor
    const merchants = await this.repository.findMany<any>({
      where: {
        userMerchant: {
          some: {
            userId,
          },
        },
      },
      include: {
        wallet: true,
      },
    });

    return merchants;
  }

  async getMerchantById(id: string): Promise<Merchant> {
    const merchant = await this.repository.findUnique<Merchant>({
      where: {
        id,
      },
      include: {
        wallet: true,
      },
    });

    return merchant;
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

  async updateMerchant(
    merchantId: string,
    data: Prisma.MerchantUpdateInput,
  ): Promise<Merchant> {
    const merchant = await this.repository.update<Merchant>({
      where: {
        id: merchantId,
      },
      data,
    });
    return merchant;
  }

  async deleteMerchant(id: string): Promise<Merchant> {
    const merchant = await this.repository.delete({
      where: {
        id,
      },
    });

    return merchant;
  }
}
