import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ApiKeyDBService } from '../services/api-key-db.service';
import { API_KEY_NOT_FOUND } from 'src/errors/error.constants';
import { ApiKey } from '@prisma/client';
import { logAndRethrowOrInternalError } from 'src/common/utils/handler-error.util';

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
      logAndRethrowOrInternalError(this.logger, error, [NotFoundException]);
    }
  }
}
