import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { TempLinkDBService } from '../service/templink-db.service';
import { logAndRethrowOrInternalError } from 'src/common/utils/handler-error.util';

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
      logAndRethrowOrInternalError(this.logger, error, [NotFoundException]);
    }
  }
}
