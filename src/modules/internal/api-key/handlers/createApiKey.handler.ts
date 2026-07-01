import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ApiKeyDBService } from '../services/api-key-db.service';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';
import { ApiKey, Prisma } from '@prisma/client';
import { TokenService } from 'src/providers/token/token.service';

@Injectable()
export class CreateApiKey {
  private readonly logger = new Logger(CreateApiKey.name);

  constructor(
    private readonly db: ApiKeyDBService,
    private readonly tokenService: TokenService,
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
      this.logger.error(
        `Error message : ${error.message}, \n Error detail : ${error}`,
      );
      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }
}
