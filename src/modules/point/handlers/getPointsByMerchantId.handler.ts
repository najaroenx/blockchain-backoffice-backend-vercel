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

@Injectable()
export class GetPointsByMerchantId {
  private logger = new Logger(GetPointsByMerchantId.name);

  constructor(private db: PointDBService) {}

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

  async execute(
    merchantId: string,
    query: Record<string, any> = {},
  ): Promise<GetPointsResponseType> {
    try {
      const sortValue = this.parseJSON<[string, 'ASC' | 'DESC']>(
        query.sort || query._sort,
      );
      const rangeValue = this.parseJSON<[number, number]>(
        query.range || query._range,
      );
      const filterValue = this.parseJSON<Record<string, any>>(
        query.filter || query._filter,
      );

      // Whitelist of allowed sortable fields to prevent prototype pollution
      const ALLOWED_SORT_FIELDS = [
        'id',
        'name',
        'symbol',
        'decimals',
        'contractAddress',
        'merchantId',
        'createdAt',
        'updatedAt',
        'imageUrl',
      ] as const;

      let orderBy: Prisma.PointOrderByWithRelationInput | undefined;
      if (Array.isArray(sortValue) && sortValue.length === 2) {
        const [field, order] = sortValue;
        if (
          typeof field === 'string' &&
          field &&
          ALLOWED_SORT_FIELDS.includes(field as any)
        ) {
          const orderDirection =
            order?.toLowerCase() === 'desc' ? 'desc' : 'asc';
          orderBy = {
            [field]: orderDirection,
          } as Prisma.PointOrderByWithRelationInput;
        }
      }

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

      if (take === undefined && query.take !== undefined) {
        const parsedTake = Number(query.take);
        if (Number.isFinite(parsedTake) && parsedTake >= 0) {
          take = Math.trunc(parsedTake);
        }
      }

      if (skip === undefined) {
        const rawSkip = query.skip ?? query.offset ?? query.start;
        if (rawSkip !== undefined) {
          const parsedSkip = Number(rawSkip);
          if (Number.isFinite(parsedSkip) && parsedSkip >= 0) {
            skip = Math.trunc(parsedSkip);
          }
        }
      }

      const where = this.buildWhere(filterValue);

      const { points, total } = await this.db.getPointsByMerchant(merchantId, {
        skip,
        take,
        orderBy,
        where,
      });

      const cleanPoint = points.map((point) => ({
        ...point,
        contractAddress: convertBufferToAddress(point.contractAddress),
      }));

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
