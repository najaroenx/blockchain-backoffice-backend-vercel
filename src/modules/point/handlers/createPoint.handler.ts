import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';
import { Point, Prisma } from '@prisma/client';
import { PointDBService } from '../services/point-db.service';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';

@Injectable()
export class CreatePoint {
  constructor(
    private db: PointDBService,
    private blockchainService: BlockchainService,
  ) {}

  async execute(
    merchantId: string,
    data: Omit<Omit<Prisma.PointCreateInput, 'contractAddress'>, 'merchant'>,
  ): Promise<Point> {
    try {
      const pointContractAddress =
        await this.blockchainService.createNewPointToken(data);

      const point = await this.db.createPoint(
        merchantId,
        pointContractAddress,
        data,
      );

      return point;
    } catch (error) {
      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }
}
