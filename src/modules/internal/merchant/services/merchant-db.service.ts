import { Injectable } from '@nestjs/common';
import { MerchantRepository } from '../merchant.repository';
import { Merchant, Prisma } from '@prisma/client';

@Injectable()
export class MerchantDBService {
  constructor(private readonly repository: MerchantRepository) {}

  async getMerchants(userId: string): Promise<any[]> {
    // refactor
    const merchants = await this.repository.findMany<any>({
      where: {
        userMerchant: {
          some: {
            userId,
          },
        },
      },
      include: {
        wallet: true,
      },
    });

    return merchants;
  }

  async getMerchantById(id: string): Promise<Merchant> {
    const merchant = await this.repository.findUnique<Merchant>({
      where: {
        id,
      },
      include: {
        wallet: true,
      },
    });

    return merchant;
  }

  async createMerchant(
    userId: string,
    data: Omit<Prisma.MerchantCreateInput, 'userMerchant'>,
  ): Promise<Merchant> {
    const merchant = await this.repository.create<Merchant>({
      data: {
        ...data,
        userMerchant: {
          create: {
            userId,
          },
        },
      },
    });

    return merchant;
  }

  async updateMerchant(
    merchantId: string,
    data: Prisma.MerchantUpdateInput,
  ): Promise<Merchant> {
    const merchant = await this.repository.update<Merchant>({
      where: {
        id: merchantId,
      },
      data,
    });
    return merchant;
  }

  async deleteMerchant(id: string): Promise<Merchant> {
    const merchant = await this.repository.delete({
      where: {
        id,
      },
    });

    return merchant;
  }

  async getAllMerchants(options: {
    page?: number;
    limit?: number;
    name?: string;
    location?: string;
    website?: string;
    hasWallet?: boolean;
    pointId?: string;
  }): Promise<{
    merchants: Merchant[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const {
      page = 1,
      limit = 20,
      name,
      location,
      website,
      hasWallet,
      pointId,
    } = options;
    const skip = (page - 1) * limit;

    // Build where clause with filters
    const where: Prisma.MerchantWhereInput = {};

    if (name) {
      where.name = {
        contains: name,
        mode: 'insensitive',
      };
    }

    if (location) {
      where.location = {
        contains: location,
        mode: 'insensitive',
      };
    }

    if (website) {
      where.website = {
        contains: website,
        mode: 'insensitive',
      };
    }

    if (hasWallet !== undefined) {
      where.walletId = hasWallet ? { not: null } : null;
    }

    if (pointId) {
      where.point = {
        some: {
          id: pointId,
        },
      };
    }

    const [merchants, total] = await Promise.all([
      this.repository.findMany<Merchant>({
        where,
        skip,
        take: limit,
        include: {
          wallet: {
            select: {
              id: true,
              walletAddress: true,
              type: true,
            }
          },
          point: {
            select: {
              id: true,
              name: true,
              symbol: true,
            },
          },
          _count: {
            select: {
              vouchers: true,
              customerMerChant: true,
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
      merchants,
      total,
      page,
      limit,
      totalPages,
    };
  }
}
