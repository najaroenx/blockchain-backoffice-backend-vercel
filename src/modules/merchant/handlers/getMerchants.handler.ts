import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';
import { MerchantDBService } from '../services/merchant-db.service';
import { GetMerchantsResponseType } from '../types';

@Injectable()
export class GetMerchants {
  private logger = new Logger(GetMerchants.name);

  constructor(private db: MerchantDBService) {}

  async execute(userId: string): Promise<GetMerchantsResponseType> {
    try {
      const merchants = await this.db.getMerchants(userId);

      return {
        merchants,
        counts: merchants.length,
      };
    } catch (error) {
      this.logger.error(
        `Error message : ${error.message}, \n Error detail : ${error}`,
      );
      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }
}
