import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Point } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';
import {
  createBufferFromHex,
  convertBufferToAddress,
} from 'src/libs/createBufferFromHex';
import {
  INTERNAL_SERVER_ERROR,
  POINT_NOT_FOUND,
} from 'src/errors/error.constants';

@Injectable()
export class UpdatePointContractAddress {
  private readonly logger = new Logger(UpdatePointContractAddress.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(
    pointId: string,
    contractAddress: string,
  ): Promise<{
    success: true;
    message: string;
    point: Omit<Point, 'contractAddress'> & { contractAddress: string };
  }> {
    try {
      if (!contractAddress || !/^0x[0-9a-fA-F]+$/.test(contractAddress)) {
        throw new BadRequestException('Invalid contractAddress format');
      }

      const point = await this.prisma.point.update({
        where: { id: pointId },
        data: {
          contractAddress: new Uint8Array(createBufferFromHex(contractAddress)),
        },
      });

      return {
        success: true,
        message: 'Point contractAddress updated successfully',
        point: {
          ...point,
          contractAddress: convertBufferToAddress(
            Buffer.from(point.contractAddress),
          ),
        },
      };
    } catch (error) {
      this.logger.error(
        `Error message : ${error.message}, \n Error detail : ${error}`,
      );
      if (error instanceof BadRequestException) {
        throw error;
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException(POINT_NOT_FOUND);
      }
      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }
}
