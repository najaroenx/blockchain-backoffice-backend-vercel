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
export class DeleteApiKey {
  private logger = new Logger(DeleteApiKey.name);

  constructor(private db: ApiKeyDBService) {}

  async execute(id: string, merchantId: string): Promise<ApiKey> {
    try {
      const findApiKey = await this.db.getApiKeyById(id, merchantId);

      if (!findApiKey) throw new NotFoundException(API_KEY_NOT_FOUND);

      const apiKey = await this.db.deleteApiKey(id, merchantId);

      return apiKey;
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
