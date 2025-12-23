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
import { PointDBService } from '../services/point-db.service';
import { convertBufferToAddress } from 'src/libs/convertBufferToAddress';
import { GetPointByIdResponseType } from '../types';

@Injectable()
export class GetPointById {
  private logger = new Logger(GetPointById.name);

  constructor(private db: PointDBService) {}

  async execute(
    pointId: string,
    merchantId?: string,
  ): Promise<GetPointByIdResponseType> {
    try {
      this.logger.log(`[START] Getting point by id: ${pointId}`);

      const point = await this.db.getPointById(pointId, merchantId);

      if (!point) {
        this.logger.error(`[ERROR] Point with id ${pointId} not found`);
        throw new NotFoundException(POINT_NOT_FOUND);
      }

      this.logger.log(`[SUCCESS] Retrieved point ${pointId} successfully`);

      return {
        point: {
          ...point,
          contractAddress: convertBufferToAddress(point.contractAddress),
        },
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
