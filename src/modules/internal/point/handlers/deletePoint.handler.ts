import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PointDBService } from '../services/point-db.service';
import {
  API_KEY_NOT_FOUND,
  INTERNAL_SERVER_ERROR,
} from 'src/errors/error.constants';
import { Point } from '@prisma/client';

@Injectable()
export class DeletePoint {
  private logger = new Logger(DeletePoint.name);

  constructor(private db: PointDBService) {}

  async execute(id: string, merchantId: string): Promise<Point> {
    try {
      const findPoint = await this.db.getPointById(id, merchantId);

      if (!findPoint) throw new NotFoundException(API_KEY_NOT_FOUND);

      const point = await this.db.deletePoint(id, merchantId);

      return point;
    } catch (error) {
      this.logger.error(
        `Error message : ${error.message}, \n Error detail : ${error}`,
      );
      if (error instanceof NotFoundException) {
        throw error;
      } else {
        throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
      }
    }
  }
}
