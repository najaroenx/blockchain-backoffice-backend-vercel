import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';
import { GetPointById } from 'src/modules/internal/point/handlers/getPointById.handler';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';

@Injectable()
export class GetWalletBalance {
  private logger = new Logger(GetWalletBalance.name);

  constructor(
    private readonly blockchainService: BlockchainService,
    private readonly getPointByIdHandler: GetPointById,
  ) {}

  async execute(
    pointId: string,
    walletAddress: string,
  ): Promise<{ balance: string; walletAddress: string; pointId: string }> {
    try {
      this.logger.log(
        `[GetWalletBalance] Getting balance for wallet ${walletAddress}, point ${pointId}`,
      );

      // Get point information without merchant validation
      const { point } = await this.getPointByIdHandler.execute(pointId);

      this.logger.log(`[GetWalletBalance] Wallet address: ${walletAddress}`);
      this.logger.log(
        `[GetWalletBalance] Point contract: ${point.contractAddress}`,
      );

      // Get balance from blockchain
      const balance = await this.blockchainService.getBalance({
        walletAddress,
        pointAddress: point.contractAddress,
      });

      this.logger.log(
        `[GetWalletBalance] Balance retrieved: ${balance} points`,
      );

      return {
        walletAddress,
        pointId,
        balance,
      };
    } catch (error) {
      this.logger.error(`[GetWalletBalance] Failed to get wallet balance`);
      this.logger.error(`[GetWalletBalance] Error: ${error.message}`);

      // Re-throw if it's already an HttpException
      if (error.status) {
        throw error;
      }

      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }
}
