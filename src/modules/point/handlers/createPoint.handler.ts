import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';
import { Point, Prisma } from '@prisma/client';
import { PointDBService } from '../services/point-db.service';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';
import { CreatePointDto } from '../dtos';

@Injectable()
export class CreatePoint {
  private logger = new Logger(CreatePoint.name);

  constructor(
    private db: PointDBService,
    private blockchainService: BlockchainService,
  ) {}

  async execute(merchantId: string, data: CreatePointDto): Promise<Point> {
    try {
      const { imageUrl, ...rawPointData } = data;

      const pointContractAddress =
        await this.blockchainService.createNewPointToken({
          ...rawPointData,
        });

      const prismaPayload: Omit<
        Omit<Prisma.PointCreateInput, 'contractAddress'>,
        'merchant'
      > = {
        ...rawPointData,
        ...(imageUrl ? { imageUrl } : {}),
      };

      const point = await this.db.createPoint(
        merchantId,
        pointContractAddress,
        prismaPayload,
      );

      return point;
    } catch (error) {
      this.logger.error(
        `Error message : ${error.message}, \n Error detail : ${error} by contract address`,
      );
      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }
}
