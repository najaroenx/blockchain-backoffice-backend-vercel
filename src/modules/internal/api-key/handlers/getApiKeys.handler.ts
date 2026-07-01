import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ApiKeyDBService } from '../services/api-key-db.service';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';
import { GetApiKeysResponseType } from '../types';
import { PageOptionsDto } from 'src/common/dtos';

@Injectable()
export class GetApiKeys {
  private readonly logger = new Logger(GetApiKeys.name);

  constructor(private readonly db: ApiKeyDBService) {}

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
      this.logger.error(
        `Error message : ${error.message}, \n Error detail : ${error}`,
      );
      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }
}
