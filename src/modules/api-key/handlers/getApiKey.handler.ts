import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ApiKeyDBService } from '../services/api-key-db.service';
import {
  API_KEY_NOT_FOUND,
  INTERNAL_SERVER_ERROR,
} from 'src/errors/error.constants';
import { ApiKey } from '@prisma/client';

@Injectable()
export class GetApiKey {
  constructor(private db: ApiKeyDBService) {}

  async execute(apiKey: string, merchantId: string): Promise<ApiKey> {
    try {
      const apiKeyDetail = await this.db.getApiKey(apiKey, merchantId);

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
