import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ApiKeyRepository } from './api-key.repository';
import { ApiKey } from '@prisma/client';
import { TokenService } from 'src/token/token.service';

@Injectable()
export class ApiKeyService {
  constructor(
    private repository: ApiKeyRepository,
    private tokenService: TokenService,
  ) {}

  async createApiKey({
    name,
    description,
    merchantId,
  }: {
    name: string;
    description: string;
    merchantId: string;
  }): Promise<ApiKey> {
    try {
      const apiKey = await this.tokenService.generateRandomString({});

      const merchant = await this.repository.createApiKey({
        merchantId,
        data: {
          name,
          description,
          apiKey,
        },
      });

      return merchant;
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('server_error');
    }
  }

  async getApiKeys(
    merchantId: string,
  ): Promise<{ apiKeys: ApiKey[]; counts: number }> {
    try {
      const { apiKeys, counts } = await this.repository.getApiKeys(merchantId);

      if (!apiKeys && !counts) throw new NotFoundException('data_not_found');

      return {
        apiKeys,
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
}
