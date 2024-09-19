import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ApiKeyRepository } from './api-key.repository';
import { ApiKey, Prisma } from '@prisma/client';
import { TokenService } from 'src/providers/token/token.service';
import {
  API_KEY_NOT_FOUND,
  INTERNAL_SERVER_ERROR,
} from 'src/errors/error.constants';

@Injectable()
export class ApiKeyService {
  constructor(
    private repository: ApiKeyRepository,
    private tokenService: TokenService,
  ) {}

  async createApiKey(
    merchantId: string,
    data: Omit<Prisma.ApiKeyCreateInput, 'apiKey' | 'merchant'>,
  ): Promise<ApiKey> {
    try {
      const apiKey = await this.tokenService.generateRandomString({});

      const merchant = await this.repository.create({
        data: {
          ...data,
          apiKey,
          merchantId,
        },
      });

      return merchant;
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }

  async getApiKeys(
    merchantId: string,
  ): Promise<{ apiKeys: ApiKey[]; counts: number }> {
    try {
      const apiKeys: ApiKey[] = await this.repository.findMany({
        where: {
          merchantId,
        },
      });

      if (!apiKeys) throw new NotFoundException(API_KEY_NOT_FOUND);

      return {
        apiKeys,
        counts: apiKeys.length,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      } else {
        throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
      }
    }
  }

  async getApiKey(apiKey: string, merchantId: string): Promise<ApiKey> {
    try {
      const apiKeyDetail = await this.repository.findFirst({
        where: {
          apiKey,
          merchantId,
        },
      });

      if (!apiKeyDetail) throw new NotFoundException(API_KEY_NOT_FOUND);

      return apiKeyDetail;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      } else {
        throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
      }
    }
  }
}
