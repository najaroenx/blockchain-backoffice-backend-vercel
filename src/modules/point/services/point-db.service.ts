import { Injectable } from '@nestjs/common';
import { Point, Prisma } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';
import { PointRepository } from '../point.repository';

type GetPointsOptions = {
  skip?: number;
  take?: number;
  orderBy?: Prisma.PointOrderByWithRelationInput;
  where?: Prisma.PointWhereInput;
};

@Injectable()
export class PointDBService {
  constructor(
    private readonly repository: PointRepository,
    private readonly prisma: PrismaService,
  ) {}

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

  async getPointById(pointId: string, merchantId?: string): Promise<any> {
    const where: any = merchantId
      ? { id: pointId, merchantId }
      : { id: pointId };

    const point: any = await this.repository.findFirst({
      where,
      include: {
        merchant: {
          select: {
            id: true,
            name: true,
            description: true,
            imageUrl: true,
            website: true,
          },
        },
        transactions: {
          select: {
            id: true,
            amount: true,
            createdAt: true,
          },
        },
        customerPoints: {
          select: {
            balances: true,
            customerId: true,
          },
        },
      },
    });

    if (!point) {
      return null;
    }

    // Calculate statistics
    const totalTransactions = point.transactions?.length || 0;
    const totalCustomers = point.customerPoints?.length || 0;
    const totalBalance =
      point.customerPoints?.reduce(
        (sum: number, cp: any) => sum + (cp.balances || 0),
        0,
      ) || 0;

    const { transactions, customerPoints, ...pointData } = point;

    return {
      ...pointData,
      statistics: {
        totalTransactions,
        totalCustomers,
        totalBalance,
        initialSupply: pointData.initialSupply,
      },
    };
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
    const {
      page = 1,
      limit = 20,
      name,
      symbol,
      merchantId,
      merchantName,
      pointName,
    } = options;
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

  async getPointByPhone(phone: string): Promise<any> {
    const customer = await this.prisma.customer.findFirst({
      where: { tel: phone },
      include: {
        customerPoints: {
          include: {
            point: {
              include: {
                merchant: {
                  select: {
                    id: true,
                    name: true,
                    description: true,
                    imageUrl: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!customer) {
      return {
        phone,
        customerId: null,
        points: [],
      };
    }

    return {
      phone,
      customerId: customer.id,
      points: customer.customerPoints.map((cp) => ({
        pointId: cp.point?.id,
        name: cp.point?.name,
        symbol: cp.point?.symbol,
        imageUrl: cp.point?.imageUrl,
        balance: cp.balances,
        merchantId: cp.point?.merchantId,
        merchant: cp.point?.merchant,
      })),
    };
  }
}
