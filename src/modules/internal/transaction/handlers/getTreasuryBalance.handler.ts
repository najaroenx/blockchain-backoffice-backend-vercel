import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';
import { GetPointById } from 'src/modules/internal/point/handlers/getPointById.handler';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class GetTreasuryBalance {
  private logger = new Logger(GetTreasuryBalance.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly blockchainService: BlockchainService,
    private readonly getPointByIdHandler: GetPointById,
  ) {}

  async execute(
    pointId: string,
    treasuryType: string,
  ): Promise<{
    balance: string;
    walletAddress: string;
    pointId: string;
    treasuryType: string;
  }> {
    try {
      this.logger.log(
        `[GetTreasuryBalance] Getting balance for treasury type: ${treasuryType}, point: ${pointId}`,
      );

      // Get treasury by type
      const treasury = await this.prisma.treasury.findUnique({
        where: { type: treasuryType },
      });

      if (!treasury) {
        throw new NotFoundException(
          `Treasury with type '${treasuryType}' not found`,
        );
      }

      this.logger.log(
        `[GetTreasuryBalance] Found treasury wallet: ${treasury.walletAddress}`,
      );

      // Get point information
      const { point } = await this.getPointByIdHandler.execute(pointId);

      this.logger.log(
        `[GetTreasuryBalance] Point contract: ${point.contractAddress}`,
      );

      // Get balance from blockchain
      const { balance } = await this.blockchainService.getBalance({
        walletAddress: treasury.walletAddress,
        pointAddress: point.contractAddress,
      });

      this.logger.log(
        `[GetTreasuryBalance] Balance retrieved: ${balance} points`,
      );

      return {
        walletAddress: treasury.walletAddress,
        pointId,
        balance,
        treasuryType: treasury.type,
      };
    } catch (error) {
      this.logger.error(
        `[GetTreasuryBalance] Failed to get treasury balance: ${error.message}`,
      );
      if (
        error instanceof NotFoundException ||
        error.name === 'NotFoundException'
      ) {
        throw error;
      }
      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }
}
