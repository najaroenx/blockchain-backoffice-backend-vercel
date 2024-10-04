import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ApiKeyDBService } from '../services/api-key-db.service';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';
import { GetApiKeysResponseType } from '../types';

@Injectable()
export class GetApiKeys {
  constructor(private db: ApiKeyDBService) {}

  async execute(merchantId: string): Promise<GetApiKeysResponseType> {
    try {
      const apiKeys = await this.db.getApiKeys(merchantId);

      return {
        apiKeys,
        counts: apiKeys.length,
      };
    } catch (error) {
      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }
}
