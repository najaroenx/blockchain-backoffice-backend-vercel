import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PointRepository } from './point.repository';
import { Point } from '@prisma/client';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';
import {
  INTERNAL_SERVER_ERROR,
  POINT_NOT_FOUND,
} from 'src/errors/error.constants';
import { TransactionService } from 'src/transaction/transaction.service';

@Injectable()
export class PointService {
  constructor(
    private repository: PointRepository,
    private blockchainService: BlockchainService,
    private transactionService: TransactionService,
  ) {}

  async getPoints(
    merchantId: string,
  ): Promise<{ points: Point[]; counts: number }> {
    try {
      const points: Point[] = await this.repository.findMany({
        where: {
          merchant: {
            userMerchant: {
              some: {
                merchantId,
              },
            },
          },
        },
      });

      if (!points) throw new NotFoundException(POINT_NOT_FOUND);

      return {
        points,
        counts: points.length,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      } else {
        throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
      }
    }
  }

  async createPoint({
    name,
    symbol,
    initialSupply,
    decimal,
    frameSize,
    slotSize,
    merchantId,
  }: {
    name: string;
    symbol: string;
    initialSupply: number;
    decimal: number;
    frameSize: number;
    slotSize: number;
    merchantId: string;
  }): Promise<Point> {
    try {
      const pointContractAddress =
        await this.blockchainService.createNewPointToken({
          name,
          symbol,
          decimal,
          slotSize,
          frameSize,
          initialSupply,
        });

      const point: Point = await this.repository.create({
        data: {
          name,
          symbol,
          initialSupply,
          decimal,
          frameSize,
          slotSize,
          contractAddress: pointContractAddress,
          merchantId,
        },
      });

      return point;
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }

  async transaction({
    merchantId,
    amount,
    receiverAddress,
    transactionTypeId,
    pointId,
    email,
  }: {
    merchantId: string;
    amount: number;
    receiverAddress: string;
    transactionTypeId: string;
    email: string;
    pointId: string;
  }) {
    try {
      const point = await this.repository.findUnique({
        where: {
          id: pointId,
        },
      });

      if (!point) throw new NotFoundException(POINT_NOT_FOUND);

      const { txId } = await this.blockchainService.transaction({
        amount,
        to: receiverAddress,
        pointContractAddress: point.contractAddress,
      });

      const transaction = await this.transactionService.createTransacetion({
        txHash: txId,
        receiverAddress,
        amount,
        transactionTypeId,
        email,
        merchantId,
        pointId,
      });

      return transaction.id;
    } catch (error) {
      console.log(error);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }
}
