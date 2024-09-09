import { Injectable } from '@nestjs/common';
import { Point, Prisma } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';
import { PrismaRepository } from 'src/repository';

@Injectable()
export class PointRepository extends PrismaRepository<'point'> {
  constructor() {
    super(new PrismaService(), 'point');
  }

  async getPoints(
    userId: string,
  ): Promise<{ points: Point[]; counts: number } | undefined> {
    const points = await this.findMany({
      where: {
        Merchant: {
          userMerchant: {
            some: {
              userId: userId,
            },
          },
        },
      },
    });

    const counts = await this.count({
      where: {
        Merchant: {
          userMerchant: {
            some: {
              userId: userId,
            },
          },
        },
      },
    });

    return { points, counts };
  }

  async createPoint({
    merchantId,
    data,
  }: {
    merchantId: string;
    data: Prisma.PointCreateInput;
  }): Promise<Point> {
    const point = await this.create({
      data: {
        ...data,
        Merchant: {
          connect: {
            id: merchantId,
          },
        },
      },
    });

    return point;
  }
}
