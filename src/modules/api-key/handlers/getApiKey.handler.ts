import {
  Injectable,
  InternalServerErrorException,
  Logger,
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
  private logger = new Logger(GetApiKey.name);

  constructor(private db: ApiKeyDBService) {}

  async execute(apiKey: string, merchantId: string): Promise<ApiKey> {
    try {
      const apiKeyDetail = await this.db.getApiKey(apiKey, merchantId);

      if (!apiKeyDetail) throw new NotFoundException(API_KEY_NOT_FOUND);

      return apiKeyDetail;
    } catch (error) {
      this.logger.error(
        `Error message : ${error.message}, \n Error detail : ${error}`,
      );
      if (error instanceof NotFoundException) {
        throw error;
      } else {
        throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
      }
    }
  }
}
