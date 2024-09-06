import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PointRepository } from './point.repository';
import { createNewPointToken } from 'src/blockchain/createNewPointToken';

@Injectable()
export class PointService {
  constructor(private repository: PointRepository) {}

  async getPoints(userId: string) {
    try {
      const { points, counts } = await this.repository.getPoints(userId);

      if (!points && !counts) throw new NotFoundException('data_not_found');

      return {
        points,
        counts,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      } else {
        throw new InternalServerErrorException('server_error');
      }
    }
  }

  async createPoint({
    name,
    symbol,
    initialSupply,
    decimal,
    frameSize,
    slotSize,
    merchantId,
  }: {
    name: string;
    symbol: string;
    initialSupply: number;
    decimal: number;
    frameSize: number;
    slotSize: number;
    merchantId: string;
  }) {
    try {
      const pointContractAddress = await createNewPointToken({
        name,
        symbol,
        decimal,
        slotSize,
        frameSize,
        initialSupply,
      });

      const point = await this.repository.createPoint({
        name,
        symbol,
        initialSupply,
        decimal,
        frameSize,
        slotSize,
        contractAddress: pointContractAddress,
        merchantId: merchantId,
      });

      return point;
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('server_error');
    }
  }
}
