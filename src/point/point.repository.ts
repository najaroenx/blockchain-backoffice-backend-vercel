import { Injectable } from '@nestjs/common';
import { Point } from '@prisma/client';
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
    name,
    symbol,
    initialSupply,
    decimal,
    frameSize,
    slotSize,
    contractAddress,
    merchantId,
  }: {
    name: string;
    symbol: string;
    initialSupply: number;
    decimal: number;
    frameSize: number;
    slotSize: number;
    contractAddress: string;
    merchantId: string;
  }): Promise<Point> {
    const point = await this.create({
      data: {
        name,
        symbol,
        initialSupply,
        decimal,
        frameSize,
        slotSize,
        contractAddress,
        merchantId,
      },
    });

    return point;
  }
}
