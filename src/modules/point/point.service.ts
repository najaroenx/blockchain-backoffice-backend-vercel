import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PointRepository } from './point.repository';
import { Point } from '@prisma/client';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';
import {
  INTERNAL_SERVER_ERROR,
  POINT_NOT_FOUND,
} from 'src/errors/error.constants';

@Injectable()
export class PointService {
  constructor(
    private repository: PointRepository,
    private blockchainService: BlockchainService,
  ) {}

  async getPoints(
    merchantId: string,
  ): Promise<{ points: Point[]; counts: number }> {
    try {
      const points: Point[] = await this.repository.findMany({
        where: {
          merchant: {
            userMerchant: {
              some: {
                merchantId,
              },
            },
          },
        },
      });

      if (!points) throw new NotFoundException(POINT_NOT_FOUND);

      return {
        points,
        counts: points.length,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      } else {
        throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
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
  }): Promise<Point> {
    try {
      const pointContractAddress =
        await this.blockchainService.createNewPointToken({
          name,
          symbol,
          decimal,
          slotSize,
          frameSize,
          initialSupply,
        });

      const point: Point = await this.repository.create({
        data: {
          name,
          symbol,
          initialSupply,
          decimal,
          frameSize,
          slotSize,
          contractAddress: pointContractAddress,
          merchantId,
        },
      });

      return point;
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }
}
