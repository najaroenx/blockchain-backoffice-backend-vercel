import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { TempLinkDBService } from '../service/templink-db.service';
import { logAndRethrowOrInternalError } from 'src/common/utils/handler-error.util';

@Injectable()
export class DeleteTempLink {
  private readonly logger = new Logger(DeleteTempLink.name);

  constructor(private readonly db: TempLinkDBService) {}

  async execute(uid: string) {
    try {
      const existing = await this.db.getTempLinkByUid(uid);

      if (!existing) {
        throw new NotFoundException(`Temp link with uid ${uid} not found`);
      }

      await this.db.deleteTempLink(uid);

      return {
        message: 'Temp link deleted successfully',
      };
    } catch (error) {
      logAndRethrowOrInternalError(this.logger, error, [NotFoundException]);
    }
  }
}
