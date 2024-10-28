import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ApiKeyDBService } from '../services/api-key-db.service';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';
import { GetApiKeysResponseType } from '../types';
import { PageOptionsDto } from 'src/common/dtos';

@Injectable()
export class GetApiKeys {
  constructor(private db: ApiKeyDBService) {}

  async execute(
    merchantId: string,
    pageOptionsDto: PageOptionsDto,
  ): Promise<
    GetApiKeysResponseType & {
      lower: number;
      upper: number;
    }
  > {
    try {
      const { apiKeys, count } = await this.db.getApiKeys(
        merchantId,
        pageOptionsDto,
      );

      return {
        apiKeys,
        counts: count,
        lower: pageOptionsDto.skip,
        upper: pageOptionsDto.skip + pageOptionsDto.take - 1,
      };
    } catch (error) {
      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }
}
