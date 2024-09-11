import { Injectable } from '@nestjs/common';
import { ApiKey, Prisma } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';
import { PrismaRepository } from 'src/repository';

@Injectable()
export class ApiKeyRepository extends PrismaRepository<'apiKey'> {
  constructor() {
    super(new PrismaService(), 'apiKey');
  }

  async createApiKey({
    merchantId,
    data,
  }: {
    merchantId: string;
    data: Prisma.ApiKeyCreateInput;
  }): Promise<ApiKey> {
    const apiKey = await this.create({
      data: {
        ...data,
        Merchant: {
          connect: {
            id: merchantId,
          },
        },
      },
    });

    return apiKey;
  }

  async getApiKeys(
    merchantId: string,
  ): Promise<{ apiKeys: ApiKey[]; counts: number } | undefined> {
    const apiKeys = await this.findMany({
      where: {
        merchantId: merchantId,
      },
    });

    const counts = await this.count({
      where: {
        merchantId: merchantId,
      },
    });

    return { apiKeys, counts };
  }
}
