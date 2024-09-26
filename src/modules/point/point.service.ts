import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PointRepository } from './point.repository';
import { Point, Prisma } from '@prisma/client';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';
import {
  INTERNAL_SERVER_ERROR,
  POINT_NOT_FOUND,
} from 'src/errors/error.constants';
import { convertBufferToAddress } from 'src/libs/convertBufferToAddress';

@Injectable()
export class PointService {
  constructor(
    private repository: PointRepository,
    private blockchainService: BlockchainService,
  ) {}

  async getPointsByMerchant(merchantId: string): Promise<{
    points: Array<Omit<Point, 'contractAddress'> & { contractAddress: string }>;
    counts: number;
  }> {
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

      const cleanPoint = points.map((point) => ({
        ...point,
        contractAddress: convertBufferToAddress(point.contractAddress),
      }));

      return {
        points: cleanPoint,
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

  async getPointById(pointId: string): Promise<{
    point: Omit<Point, 'contractAddress'> & { contractAddress: string };
  }> {
    try {
      const point: Point = await this.repository.findUnique({
        where: {
          id: pointId,
        },
      });

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

  async createPoint(
    merchantId: string,
    data: Omit<Omit<Prisma.PointCreateInput, 'contractAddress'>, 'merchant'>,
  ): Promise<Point> {
    try {
      const pointContractAddress =
        await this.blockchainService.createNewPointToken(data);

      const point: Point = await this.repository.create({
        data: {
          ...data,
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

  async updatePoint(
    pointId: string,
    data: Prisma.PointUpdateInput,
  ): Promise<{ point: Point }> {
    try {
      const point = await this.repository.update({
        where: {
          id: pointId,
        },
        data,
      });

      return { point };
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }
}
