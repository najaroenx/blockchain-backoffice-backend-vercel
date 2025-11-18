import {
  Injectable,
  InternalServerErrorException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';
import { Point, Prisma } from '@prisma/client';
import { PointDBService } from '../services/point-db.service';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';
import { CreatePointDto } from '../dtos';
import { GetMerchant } from 'src/modules/merchant/handlers/getMerchantById.handler';

@Injectable()
export class CreatePoint {
  private logger = new Logger(CreatePoint.name);

  constructor(
    private db: PointDBService,
    private blockchainService: BlockchainService,
    private getMerchant: GetMerchant,
  ) {}

  async execute(merchantId: string, data: CreatePointDto): Promise<Point> {
    try {
      const { imageUrl, ...rawPointData } = data;

      // Get merchant wallet address to receive initial supply
      this.logger.log(
        `[CreatePoint] Getting merchant ${merchantId} wallet address`,
      );
      const { merchant } = await this.getMerchant.execute(merchantId);
      const merchantWalletAddress =
        (merchant as any).wallet?.walletAddress || '';

      if (!merchantWalletAddress) {
        this.logger.error(
          `[CreatePoint] Merchant ${merchantId} wallet not configured`,
        );
        throw new BadRequestException('Merchant wallet not configured');
      }

      this.logger.log(
        `[CreatePoint] Merchant wallet address: ${merchantWalletAddress}`,
      );
      this.logger.log(
        `[CreatePoint] Creating point contract with initial supply: ${data.initialSupply}`,
      );

      const pointContractAddress =
        await this.blockchainService.createNewPointToken({
          ...rawPointData,
          ownerAddress: merchantWalletAddress,
        });

      this.logger.log(
        `[CreatePoint] Point contract created: ${pointContractAddress}`,
      );

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
