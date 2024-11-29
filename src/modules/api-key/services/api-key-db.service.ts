import { Injectable } from '@nestjs/common';
import { ApiKeyRepository } from '../api-key.repository';
import { ApiKey, Prisma } from '@prisma/client';
import { PageOptionsDto } from 'src/common/dtos';

@Injectable()
export class ApiKeyDBService {
  constructor(private readonly repository: ApiKeyRepository) {}

  async getApiKeys(
    merchantId: string,
    pageOptionsDto: PageOptionsDto,
  ): Promise<{ apiKeys: ApiKey[]; count: number }> {
    const count = await this.repository.count({
      where: {
        merchantId,
      },
    });

    const apiKeys = await this.repository.findMany<ApiKey>({
      where: {
        merchantId,
      },
      take: pageOptionsDto.take,
      skip: pageOptionsDto.skip,
    });

    return { apiKeys, count };
  }

  async getApiKey(
    apiKey: string,
    merchantId: string,
  ): Promise<ApiKey | undefined> {
    const apiKeyDetail = await this.repository.findFirst<ApiKey | undefined>({
      where: {
        apiKey,
        merchantId,
      },
    });

    return apiKeyDetail;
  }

  async getApiKeyById(
    id: string,
    merchantId: string,
  ): Promise<ApiKey | undefined> {
    const apiKeyDetail = await this.repository.findFirst<ApiKey | undefined>({
      where: {
        id,
        merchantId,
      },
    });

    return apiKeyDetail;
  }

  async createApiKey(
    merchantId: string,
    generatedApiKey: string,
    data: Omit<Prisma.ApiKeyCreateInput, 'apiKey' | 'merchant'>,
  ): Promise<ApiKey> {
    const apiKey = await this.repository.create<ApiKey>({
      data: {
        ...data,
        apiKey: generatedApiKey,
        merchantId,
      },
    });

    return apiKey;
  }

  async deleteApiKy(id: string, merchantId: string): Promise<ApiKey> {
    const apiKey = await this.repository.delete({
      where: {
        id,
        merchantId,
      },
    });

    return apiKey;
  }
}
