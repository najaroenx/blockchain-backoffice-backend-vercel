import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  INTERNAL_SERVER_ERROR,
  POINT_NOT_FOUND,
} from 'src/errors/error.constants';
import { GetPointByPhoneResponseType } from '../types';
import { PointDBService } from '../services/point-db.service';

@Injectable()
export class GetPointByPhone {
  private readonly logger = new Logger(GetPointByPhone.name);

  constructor(private readonly db: PointDBService) {}

  async execute(phone: string): Promise<GetPointByPhoneResponseType> {
    try {
      this.logger.log(`[START] Getting point by phone: ${phone}`);

      const point = await this.db.getPointByPhone(phone);

      if (!point) {
        this.logger.error(`[ERROR] Point with phone ${phone} not found`);
        throw new NotFoundException(POINT_NOT_FOUND);
      }

      this.logger.log(
        `[SUCCESS] Retrieved point for phone ${phone} successfully`,
      );
      return {
        customerPoints: point,
      };
    } catch (error) {
      this.logger.error(
        `[FATAL ERROR] Failed to get point: ${error.message}`,
        error.stack,
      );
      if (error instanceof NotFoundException) {
        throw error;
      } else {
        throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
      }
    }
  }
}
