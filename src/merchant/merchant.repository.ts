import { Injectable } from '@nestjs/common';
import { Merchant } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';
import { PrismaRepository } from 'src/repository';

@Injectable()
export class MerchantRepository extends PrismaRepository<'merchant'> {
  constructor() {
    super(new PrismaService(), 'merchant');
  }

  async getMerchants(
    userId: string,
  ): Promise<{ merchants: Merchant[]; counts: number } | undefined> {
    const merchants = await this.findMany({
      where: {
        userMerchant: {
          some: {
            userId,
          },
        },
      },
    });

    const counts = await this.count({
      where: {
        userMerchant: {
          some: {
            userId,
          },
        },
      },
    });

    return { merchants, counts };
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
    const merchant = await this.create({
      data: {
        name,
        website,
        userMerchant: {
          create: {
            userId: userId,
          },
        },
      },
    });

    return merchant;
  }
}
