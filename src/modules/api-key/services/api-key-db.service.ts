import { Injectable } from '@nestjs/common';
import { ApiKeyRepository } from '../api-key.repository';
import { ApiKey, Prisma } from '@prisma/client';

@Injectable()
export class ApiKeyDBService {
  constructor(private readonly repository: ApiKeyRepository) {}

  async getApiKeys(merchantId: string): Promise<ApiKey[]> {
    const apiKeys = await this.repository.findMany<ApiKey>({
      where: {
        merchantId,
      },
    });

    return apiKeys;
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
}
