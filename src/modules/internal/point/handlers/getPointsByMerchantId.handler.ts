import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';
import { PointDBService } from '../services/point-db.service';
import { GetPointsResponseType } from '../types';
import { convertBufferToAddress } from 'src/libs/convertBufferToAddress';
import { Prisma } from '@prisma/client';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class GetPointsByMerchantId {
  private readonly logger = new Logger(GetPointsByMerchantId.name);

  constructor(
    private readonly db: PointDBService,
    private readonly blockchainService: BlockchainService,
    private readonly prisma: PrismaService,
  ) {}

  private parseJSON<T>(value: unknown): T | null {
    if (!value) return null;
    if (typeof value === 'string') {
      try {
        return JSON.parse(value) as T;
      } catch {
        return null;
      }
    }
    return value as T;
  }

  private buildWhere(
    filter: Record<string, any> | null,
  ): Prisma.PointWhereInput {
    if (!filter) return {};

    const where: Prisma.PointWhereInput = {};
    const { q, name, symbol } = filter;

    if (typeof q === 'string' && q.trim()) {
      const search = q.trim();
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { symbol: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (typeof name === 'string' && name.trim()) {
      where.name = {
        contains: name.trim(),
        mode: 'insensitive',
      };
    }

    if (typeof symbol === 'string' && symbol.trim()) {
      where.symbol = {
        contains: symbol.trim(),
        mode: 'insensitive',
      };
    }

    return where;
  }

  // Whitelist of allowed sortable fields to prevent prototype pollution
  private readonly ALLOWED_SORT_FIELDS: ReadonlySet<string> = new Set([
    'id',
    'name',
    'symbol',
    'decimals',
    'contractAddress',
    'merchantId',
    'createdAt',
    'updatedAt',
    'imageUrl',
  ]);

  private parseSortOrder(
    query: Record<string, any>,
  ): Prisma.PointOrderByWithRelationInput | undefined {
    const sortValue = this.parseJSON<[string, 'ASC' | 'DESC']>(
      query.sort || query._sort,
    );

    if (!Array.isArray(sortValue) || sortValue.length !== 2) return undefined;

    const [field, order] = sortValue;
    if (
      typeof field !== 'string' ||
      !field ||
      !this.ALLOWED_SORT_FIELDS.has(field)
    ) {
      return undefined;
    }

    const orderDirection = order.toUpperCase() === 'DESC' ? 'desc' : 'asc';
    return { [field]: orderDirection } as Prisma.PointOrderByWithRelationInput;
  }

  private parsePagination(query: Record<string, any>): {
    skip?: number;
    take?: number;
  } {
    const rangeValue = this.parseJSON<[number, number]>(
      query.range || query._range,
    );

    let skip: number | undefined;
    let take: number | undefined;

    if (
      Array.isArray(rangeValue) &&
      rangeValue.length === 2 &&
      Number.isFinite(rangeValue[0]) &&
      Number.isFinite(rangeValue[1])
    ) {
      const [start, end] = rangeValue.map((value) =>
        Math.max(0, Math.trunc(Number(value))),
      );
      skip = start;
      take = end >= start ? end - start + 1 : undefined;
    }

    if (take === undefined) {
      take = this.parsePositiveInt(query.take);
    }

    if (skip === undefined) {
      const rawSkip = query.skip ?? query.offset ?? query.start;
      skip = this.parsePositiveInt(rawSkip);
    }

    return { skip, take };
  }

  private parsePositiveInt(value: unknown): number | undefined {
    if (value === undefined) return undefined;
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return Math.trunc(parsed);
    }
    return undefined;
  }

  private async enrichPointsWithBalance(
    points: Awaited<
      ReturnType<PointDBService['getPointsByMerchant']>
    >['points'],
    merchantWalletAddress: string | undefined,
  ) {
    return Promise.all(
      points.map(async (point) => {
        const contractAddress = convertBufferToAddress(point.contractAddress);
        const remaining = await this.getPointBalance(
          point.id,
          merchantWalletAddress,
          contractAddress,
        );
        return { ...point, contractAddress, remaining };
      }),
    );
  }

  private async getPointBalance(
    pointId: string,
    merchantWalletAddress: string | undefined,
    contractAddress: string,
  ): Promise<string | null> {
    if (!merchantWalletAddress) return null;

    try {
      const result = await this.blockchainService.getBalance({
        walletAddress: merchantWalletAddress,
        pointAddress: contractAddress,
      });
      return result.balance;
    } catch (error) {
      this.logger.warn(
        `Failed to get balance for point ${pointId}: ${error.message}`,
      );
      return null;
    }
  }

  async execute(
    merchantId: string,
    query: Record<string, any> = {},
  ): Promise<GetPointsResponseType> {
    try {
      const orderBy = this.parseSortOrder(query);
      const { skip, take } = this.parsePagination(query);

      const filterValue = this.parseJSON<Record<string, any>>(
        query.filter || query._filter,
      );
      const where = this.buildWhere(filterValue);

      const { points, total } = await this.db.getPointsByMerchant(merchantId, {
        skip,
        take,
        orderBy,
        where,
      });

      const merchant = await this.prisma.merchant.findUnique({
        where: { id: merchantId },
        include: { wallet: true },
      });

      const cleanPoint = await this.enrichPointsWithBalance(
        points,
        merchant?.wallet?.walletAddress,
      );

      return {
        points: cleanPoint,
        counts: total,
      };
    } catch (error) {
      this.logger.error(
        `Error message : ${error.message}, \n Error detail : ${error}`,
      );
      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }
}
