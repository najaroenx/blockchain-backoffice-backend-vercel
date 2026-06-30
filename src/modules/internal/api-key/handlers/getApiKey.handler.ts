import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ApiKeyDBService } from '../services/api-key-db.service';
import { API_KEY_NOT_FOUND } from 'src/errors/error.constants';
import { ApiKey } from '@prisma/client';
import { logAndRethrowOrInternalError } from 'src/common/utils/handler-error.util';

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
      logAndRethrowOrInternalError(this.logger, error, [NotFoundException]);
    }
  }
}
