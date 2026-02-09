import {
  Injectable,
  Logger,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { TempLinkDBService } from '../service/templink-db.service';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';

@Injectable()
export class UpdateTempLink {
  private logger = new Logger(UpdateTempLink.name);

  constructor(private db: TempLinkDBService) {}

  async execute(uid: string, expire?: Date) {
    try {
      const existing = await this.db.getTempLinkByUid(uid);

      if (!existing) {
        throw new NotFoundException(`Temp link with uid ${uid} not found`);
      }

      const tempLink = await this.db.updateTempLink(uid, {
        expire: expire || existing.expire,
      });

      return {
        uid: tempLink.uid,
        phoneNumber: tempLink.phoneNumber,
        merchantId: tempLink.merchantId,
        expire: tempLink.expire,
        updatedAt: tempLink.updatedAt,
      };
    } catch (error) {
      this.logger.error(
        `Error message: ${error.message}, \n Error detail: ${error}`,
      );
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }
}
