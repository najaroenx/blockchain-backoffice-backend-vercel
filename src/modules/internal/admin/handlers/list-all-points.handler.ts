import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { Point } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';
import { convertBufferToAddress } from 'src/libs/createBufferFromHex';

@Injectable()
export class ListAllPoints {
  private readonly logger = new Logger(ListAllPoints.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(): Promise<{
    points: Array<Omit<Point, 'contractAddress'> & { contractAddress: string }>;
    counts: number;
  }> {
    try {
      const points = await this.prisma.point.findMany({
        orderBy: {
          createdAt: 'desc',
        },
      });

      const formattedPoints = points.map((point) => ({
        ...point,
        contractAddress: convertBufferToAddress(
          Buffer.from(point.contractAddress),
        ),
      }));

      return {
        points: formattedPoints,
        counts: points.length,
      };
    } catch (error) {
      this.logger.error(
        `Error message : ${error.message}, \n Error detail : ${error}`,
      );
      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }
}
