import {
  Injectable,
  Logger,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { TempLinkDBService } from '../service/templink-db.service';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';

@Injectable()
export class DeleteTempLink {
  private logger = new Logger(DeleteTempLink.name);

  constructor(private db: TempLinkDBService) {}

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
