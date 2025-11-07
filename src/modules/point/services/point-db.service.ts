import { Injectable } from '@nestjs/common';
import { Point, Prisma } from '@prisma/client';
import { PointRepository } from '../point.repository';

type GetPointsOptions = {
  skip?: number;
  take?: number;
  orderBy?: Prisma.PointOrderByWithRelationInput;
  where?: Prisma.PointWhereInput;
};

@Injectable()
export class PointDBService {
  constructor(private readonly repository: PointRepository) {}

  async getPointsByMerchant(
    merchantId: string,
    options: GetPointsOptions = {},
  ): Promise<{ points: Point[]; total: number }> {
    const where: Prisma.PointWhereInput = {
      merchantId,
      ...(options.where ?? {}),
    };

    const [points, total] = await Promise.all([
      this.repository.findMany<Point>({
        where,
        skip: options.skip,
        take: options.take,
        orderBy: options.orderBy,
      }),
      this.repository.count({
        where,
      }),
    ]);

    return { points, total };
  }

  async getPointById(pointId: string, merchantId: string): Promise<Point> {
    const point = await this.repository.findUnique<Point>({
      where: {
        id: pointId,
        merchantId,
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

  async deletePoint(id: string, merchantId: string): Promise<Point> {
    const point = await this.repository.delete({
      where: {
        id,
        merchantId,
      },
    });

    return point;
  }
}
