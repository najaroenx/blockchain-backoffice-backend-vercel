import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { TempLinkDBService } from '../service/templink-db.service';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';

@Injectable()
export class GetTempLinksByMerchant {
  private readonly logger = new Logger(GetTempLinksByMerchant.name);

  constructor(private readonly db: TempLinkDBService) {}

  async execute(merchantId: string) {
    try {
      const tempLinks = await this.db.getTempLinksByMerchant(merchantId);

      return {
        tempLinks: tempLinks.map((link) => ({
          uid: link.uid,
          phoneNumber: link.phoneNumber,
          merchantId: link.merchantId,
          expire: link.expire,
          createdAt: link.createdAt,
          updatedAt: link.updatedAt,
        })),
      };
    } catch (error) {
      this.logger.error(
        `Error message: ${error.message}, \n Error detail: ${error}`,
      );
      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }
}
