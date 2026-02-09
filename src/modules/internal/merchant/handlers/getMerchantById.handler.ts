import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  INTERNAL_SERVER_ERROR,
  MERCHANT_NOT_FOUND,
} from 'src/errors/error.constants';
import { MerchantDBService } from '../services/merchant-db.service';
import { GetMerchantResponseType } from '../types';

@Injectable()
export class GetMerchant {
  private logger = new Logger(GetMerchant.name);

  constructor(private db: MerchantDBService) {}

  async execute(id: string): Promise<GetMerchantResponseType> {
    try {
      const merchant = await this.db.getMerchantById(id);

      if (!merchant) throw new NotFoundException(MERCHANT_NOT_FOUND);

      return {
        merchant,
      };
    } catch (error) {
      this.logger.error(
        `Error message : ${error.message}, \n Error detail : ${error}`,
      );
      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }
}
