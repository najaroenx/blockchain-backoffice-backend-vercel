import {
  Injectable,
  Logger,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { TempLinkDBService } from '../service/templink-db.service';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';

@Injectable()
export class GetTempLinkByUid {
  private logger = new Logger(GetTempLinkByUid.name);

  constructor(private db: TempLinkDBService) {}

  async execute(uid: string) {
    try {
      const tempLink = await this.db.getTempLinkByUid(uid);

      if (!tempLink) {
        throw new NotFoundException(`Temp link with uid ${uid} not found`);
      }

      return {
        uid: tempLink.uid,
        phoneNumber: tempLink.phoneNumber,
        merchantId: tempLink.merchantId,
        expire: tempLink.expire,
        createdAt: tempLink.createdAt,
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
