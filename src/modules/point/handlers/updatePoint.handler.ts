import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  INTERNAL_SERVER_ERROR,
  POINT_NOT_FOUND,
} from 'src/errors/error.constants';
import { Prisma } from '@prisma/client';
import { PointDBService } from '../services/point-db.service';
import { createBufferFromHex } from 'src/libs/createBufferFromHex';
import { UpdatePointResponseType } from '../types';
import { convertBufferToAddress } from 'src/libs/convertBufferToAddress';

@Injectable()
export class UpdatePoint {
  constructor(private db: PointDBService) {}

  async execute(
    pointId: string,
    data: Omit<Prisma.PointUpdateInput, 'contractAddress'> & {
      contractAddress?: string;
    },
  ): Promise<UpdatePointResponseType> {
    try {
      const point = await this.db.updatePoint(pointId, {
        ...data,
        contractAddress: createBufferFromHex(data?.contractAddress),
      });

      return {
        point: {
          ...point,
          contractAddress: convertBufferToAddress(point.contractAddress),
        },
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundException(POINT_NOT_FOUND);
        }
      } else {
        throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
      }
    }
  }
}
