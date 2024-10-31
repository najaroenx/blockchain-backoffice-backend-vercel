import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';
import { PointDBService } from '../services/point-db.service';
import { GetPointsResponseType } from '../types';
import { convertBufferToAddress } from 'src/libs/convertBufferToAddress';

@Injectable()
export class GetPointsByMerchantId {
  private logger = new Logger(GetPointsByMerchantId.name);

  constructor(private db: PointDBService) {}

  async execute(merchantId: string): Promise<GetPointsResponseType> {
    try {
      const points = await this.db.getPointsByMerchant(merchantId);

      const cleanPoint = points.map((point) => ({
        ...point,
        contractAddress: convertBufferToAddress(point.contractAddress),
      }));

      return {
        points: cleanPoint,
        counts: cleanPoint.length,
      };
    } catch (error) {
      this.logger.error(
        `Error message : ${error.message}, \n Error detail : ${error}`,
      );
      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }
}
