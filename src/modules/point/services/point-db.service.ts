import { Injectable } from '@nestjs/common';
import { Point, Prisma } from '@prisma/client';
import { PointRepository } from '../point.repository';

@Injectable()
export class PointDBService {
  constructor(private readonly repository: PointRepository) {}

  async getPointsByMerchant(merchantId: string): Promise<Point[]> {
    const points = await this.repository.findMany<Point>({
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

    return points;
  }

  async getPointById(pointId: string): Promise<Point> {
    const point = await this.repository.findUnique<Point>({
      where: {
        id: pointId,
      },
    });
    return point;
  }

  async updatePoint(
    pointId: string,
    data: Prisma.PointUpdateInput,
  ): Promise<Point> {
    const point = await this.repository.update<Point>({
      where: {
        id: pointId,
      },
      data,
    });
    return point;
  }

  async createPoint(
    merchantId: string,
    pointContractAddress: Buffer,
    data: Omit<Omit<Prisma.PointCreateInput, 'contractAddress'>, 'merchant'>,
  ): Promise<Point> {
    const point = await this.repository.create<Point>({
      data: {
        ...data,
        contractAddress: pointContractAddress,
        merchantId,
      },
    });

    return point;
  }
}
