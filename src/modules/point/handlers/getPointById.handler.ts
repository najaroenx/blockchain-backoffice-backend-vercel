import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  INTERNAL_SERVER_ERROR,
  POINT_NOT_FOUND,
} from 'src/errors/error.constants';
import { PointDBService } from '../services/point-db.service';
import { GetPointResponseType } from '../types';
import { convertBufferToAddress } from 'src/libs/convertBufferToAddress';

@Injectable()
export class GetPointById {
  constructor(private db: PointDBService) {}

  async execute(pointId: string): Promise<GetPointResponseType> {
    try {
      const point = await this.db.getPointById(pointId);

      if (!point) throw new NotFoundException(POINT_NOT_FOUND);

      return {
        point: {
          ...point,
          contractAddress: convertBufferToAddress(point.contractAddress),
        },
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      } else {
        throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
      }
    }
  }
}
