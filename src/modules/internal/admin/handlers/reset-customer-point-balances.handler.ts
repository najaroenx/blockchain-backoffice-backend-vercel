import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';

@Injectable()
export class ResetCustomerPointBalances {
  private readonly logger = new Logger(ResetCustomerPointBalances.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(): Promise<{
    success: true;
    message: string;
    updatedCount: number;
  }> {
    try {
      const result = await this.prisma.customerPoint.updateMany({
        data: {
          balances: 0,
        },
      });

      this.logger.warn(
        `[Admin] Reset all CustomerPoint balances to 0. Updated ${result.count} record(s)`,
      );

      return {
        success: true,
        message: 'All customerPoint balances have been reset to 0',
        updatedCount: result.count,
      };
    } catch (error) {
      this.logger.error(
        `Error message : ${error.message}, \n Error detail : ${error}`,
      );
      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }
}
