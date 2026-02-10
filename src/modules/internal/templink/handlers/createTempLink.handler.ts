import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { TempLinkDBService } from '../service/templink-db.service';
import { randomUUID } from 'crypto';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';

@Injectable()
export class CreateTempLink {
  private logger = new Logger(CreateTempLink.name);

  constructor(private db: TempLinkDBService) {}

  async execute(phoneNumber: string, merchantId: string, expire: Date) {
    try {
      const uid = randomUUID();
      const tempLink = await this.db.createTempLink({
        uid,
        phoneNumber,
        merchantId,
        expire,
      });

      return {
        uid: tempLink.uid,
        phoneNumber: tempLink.phoneNumber,
        merchantId: tempLink.merchantId,
        expire: tempLink.expire,
        createdAt: tempLink.createdAt,
      };
    } catch (error) {
      this.logger.error(
        `Error message: ${error.message}, \n Error detail: ${error}`,
      );
      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }
}
