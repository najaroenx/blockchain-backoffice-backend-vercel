import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';

@Injectable()
export class GetThbBalance {
  private logger = new Logger(GetThbBalance.name);
  private readonly thbTokenAddress: string;

  constructor(
    private readonly blockchainService: BlockchainService,
    private readonly configService: ConfigService,
  ) {
    this.thbTokenAddress = this.configService.get<string>('THB_ADDRESS');
  }

  async execute(
    walletAddress: string,
  ): Promise<{ walletAddress: string; currency: string; balance: string }> {
    try {
      this.logger.log(
        `[GetThbBalance] Getting THB balance for wallet: ${walletAddress}`,
      );

      if (!this.thbTokenAddress) {
        this.logger.error('[GetThbBalance] THB_ADDRESS not configured');
        throw new InternalServerErrorException(
          'THB token address not configured',
        );
      }

      this.logger.log(
        `[GetThbBalance] THB token address: ${this.thbTokenAddress}`,
      );

      // Get balance from blockchain
      const balance = await this.blockchainService.getBalance({
        walletAddress,
        pointAddress: this.thbTokenAddress,
      });

      this.logger.log(`[GetThbBalance] Balance retrieved: ${balance} THB`);

      return {
        walletAddress,
        currency: 'THB',
        balance,
      };
    } catch (error) {
      this.logger.error(`[GetThbBalance] Failed to get THB balance`);
      this.logger.error(`[GetThbBalance] Error: ${error.message}`);

      // Re-throw if it's already an HttpException
      if (error.status) {
        throw error;
      }

      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }
}
