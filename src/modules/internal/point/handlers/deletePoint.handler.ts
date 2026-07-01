import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PointDBService } from '../services/point-db.service';
import { API_KEY_NOT_FOUND } from 'src/errors/error.constants';
import { Point } from '@prisma/client';
import { logAndRethrowOrInternalError } from 'src/common/utils/handler-error.util';

@Injectable()
export class DeletePoint {
  private readonly logger = new Logger(DeletePoint.name);

  constructor(private readonly db: PointDBService) {}

  async execute(id: string, merchantId: string): Promise<Point> {
    try {
      const findPoint = await this.db.getPointById(id, merchantId);

      if (!findPoint) throw new NotFoundException(API_KEY_NOT_FOUND);

      const point = await this.db.deletePoint(id, merchantId);

      return point;
    } catch (error) {
      logAndRethrowOrInternalError(this.logger, error, [NotFoundException]);
    }
  }
}
