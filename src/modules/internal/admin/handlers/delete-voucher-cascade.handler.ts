import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';

@Injectable()
export class DeleteVoucherCascade {
  private readonly logger = new Logger(DeleteVoucherCascade.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(): Promise<{
    success: true;
    message: string;
    deletedTransactions: number;
    deletedVoucherCodes: number;
    deletedVouchers: number;
  }> {
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const deletedTransactions = await tx.transaction.deleteMany();

        const deletedVoucherCodes = await tx.voucherCode.deleteMany();
        const deletedVouchers = await tx.voucher.deleteMany();

        return {
          deletedTransactions: deletedTransactions.count,
          deletedVoucherCodes: deletedVoucherCodes.count,
          deletedVouchers: deletedVouchers.count,
        };
      });

      this.logger.warn(
        `[Admin] Cascade deleted voucher data: transactions=${result.deletedTransactions}, voucherCodes=${result.deletedVoucherCodes}, vouchers=${result.deletedVouchers}`,
      );

      return {
        success: true,
        message:
          'Transaction, voucherCode, and voucher data deleted successfully',
        deletedTransactions: result.deletedTransactions,
        deletedVoucherCodes: result.deletedVoucherCodes,
        deletedVouchers: result.deletedVouchers,
      };
    } catch (error) {
      this.logger.error(
        `Error message : ${error.message}, \n Error detail : ${error}`,
      );
      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }
}
