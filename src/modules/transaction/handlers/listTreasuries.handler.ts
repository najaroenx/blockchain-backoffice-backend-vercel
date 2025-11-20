import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class ListTreasuries {
  private logger = new Logger(ListTreasuries.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(): Promise<{
    treasuries: Array<{
      id: string;
      walletAddress: string;
      type: string;
      createdAt: Date;
      updatedAt: Date;
    }>;
  }> {
    try {
      this.logger.log(`[ListTreasuries] Fetching all treasuries`);

      const treasuries = await this.prisma.treasury.findMany({
        orderBy: {
          type: 'asc',
        },
      });

      this.logger.log(`[ListTreasuries] Found ${treasuries.length} treasuries`);

      return {
        treasuries,
      };
    } catch (error) {
      this.logger.error(
        `[ListTreasuries] Failed to fetch treasuries: ${error.message}`,
      );
      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }
}
