import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { TempLinkDBService } from '../service/templink-db.service';
import { logAndRethrowOrInternalError } from 'src/common/utils/handler-error.util';

@Injectable()
export class UpdateTempLink {
  private readonly logger = new Logger(UpdateTempLink.name);

  constructor(private readonly db: TempLinkDBService) {}

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
      logAndRethrowOrInternalError(this.logger, error, [NotFoundException]);
    }
  }
}
