import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ApiKeyDBService } from '../services/api-key-db.service';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';
import { ApiKey, Prisma } from '@prisma/client';
import { TokenService } from 'src/providers/token/token.service';

@Injectable()
export class CreateApiKey {
  constructor(
    private db: ApiKeyDBService,
    private tokenService: TokenService,
  ) {}

  async execute(
    merchantId: string,
    data: Omit<Prisma.ApiKeyCreateInput, 'apiKey' | 'merchant'>,
  ): Promise<ApiKey> {
    try {
      const generatedApiKey = await this.tokenService.generateRandomString({});
      const apiKey = await this.db.createApiKey(
        merchantId,
        generatedApiKey,
        data,
      );

      return apiKey;
    } catch (error) {
      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }
}
