import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import {
  QueryMerchantRefStoreDto,
  PaginatedMerchantRefStoreResponse,
  MerchantRefStoreResponse,
} from '../../dtos/merchant-ref-store.dto';

@Injectable()
export class ListMerchantRefStoreHandler {
  private readonly logger = new Logger(ListMerchantRefStoreHandler.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(
    query: QueryMerchantRefStoreDto,
  ): Promise<PaginatedMerchantRefStoreResponse> {
    const {
      page = 1,
      limit = 20,
      merchantRef,
      name,
      category,
      isActive,
    } = query;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (merchantRef) {
      where.merchantRef = { contains: merchantRef, mode: 'insensitive' };
    }

    if (name) {
      where.name = { contains: name, mode: 'insensitive' };
    }

    if (category) {
      where.category = category;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    this.logger.debug(
      `Querying MerchantRefStore with filter: ${JSON.stringify(where)}`,
    );

    // Execute count and find in parallel
    const [total, data] = await Promise.all([
      this.prisma.merchantRefStore.count({ where }),
      this.prisma.merchantRefStore.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    this.logger.debug(
      `Found ${total} MerchantRefStore records, returning page ${page}/${totalPages}`,
    );

    return {
      data: data as MerchantRefStoreResponse[],
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }
}

@Injectable()
export class GetMerchantRefStoreByIdHandler {
  private readonly logger = new Logger(GetMerchantRefStoreByIdHandler.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(merchantRef: string): Promise<MerchantRefStoreResponse> {
    this.logger.debug(
      `Getting MerchantRefStore by merchantRef: ${merchantRef}`,
    );

    const store = await this.prisma.merchantRefStore.findUnique({
      where: { merchantRef },
    });

    if (!store) {
      throw new NotFoundException(
        `MerchantRefStore with merchantRef ${merchantRef} not found`,
      );
    }

    return store as MerchantRefStoreResponse;
  }
}

@Injectable()
export class GetMerchantRefStoreByRefHandler {
  private readonly logger = new Logger(GetMerchantRefStoreByRefHandler.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(merchantRef: string): Promise<MerchantRefStoreResponse> {
    this.logger.debug(
      `Getting MerchantRefStore by merchantRef: ${merchantRef}`,
    );

    const store = await this.prisma.merchantRefStore.findUnique({
      where: { merchantRef },
    });

    if (!store) {
      throw new NotFoundException(
        `MerchantRefStore with merchantRef ${merchantRef} not found`,
      );
    }

    return store as MerchantRefStoreResponse;
  }
}
