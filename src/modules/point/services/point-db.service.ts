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

  async getPointById(pointId: string, merchantId?: string): Promise<Point> {
    const where: Prisma.PointWhereUniqueInput = merchantId
      ? { id: pointId, merchantId }
      : { id: pointId };
    const point = await this.repository.findUnique<Point>({
      where,
    });
    return point;
  }

  async updatePoint(
    pointId: string,
    data: Prisma.PointUpdateInput,
  ): Promise<Point> {
    const point = await this.repository.update<Point>({
      where: { id: pointId },
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
        // contractAddress: pointContractAddress,
        contractAddress: new Uint8Array(pointContractAddress),
        merchantId,
      },
    });

    return point;
  }

  async deletePoint(id: string, merchantId: string): Promise<Point> {
    const point = await this.repository.delete({ where: { id, merchantId } });

    return point;
  }

  async getAllPoints(options: {
    page?: number;
    limit?: number;
    name?: string;
    symbol?: string;
    merchantId?: string;
    merchantName?: string;
    pointName?: string;
  }): Promise<{
    points: Point[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { page = 1, limit = 20, name, symbol, merchantId, merchantName, pointName } = options;
    const skip = (page - 1) * limit;

    // Build where clause with filters
    const where: Prisma.PointWhereInput = {};

    if (name) {
      where.name = {
        contains: name,
        mode: 'insensitive',
      };
    }

    if (symbol) {
      where.symbol = {
        contains: symbol,
        mode: 'insensitive',
      };
    }

    if (merchantId) {
      where.merchantId = merchantId;
    }

    if (merchantName) {
      where.merchant = {
        name: {
          contains: merchantName,
          mode: 'insensitive',
        },
      };
    }

    if (pointName) {
      where.name = {
        contains: pointName,
        mode: 'insensitive',
      };
    }

    const [points, total] = await Promise.all([
      this.repository.findMany<Point>({
        where,
        skip,
        take: limit,
        include: {
          merchant: {
            select: {
              id: true,
              name: true,
              description: true,
              imageUrl: true,
            },
          },
          _count: {
            select: {
              transactions: true,
              customerPoints: true,
              voucherCodes: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.repository.count({
        where,
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      points,
      total,
      page,
      limit,
      totalPages,
    };
  }
}
