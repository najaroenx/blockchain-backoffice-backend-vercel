import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';
import { GetVoucherById } from './getVoucherById.handler';

@Injectable()
export class GetVoucherByLatestCode {
  private readonly logger = new Logger(GetVoucherByLatestCode.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly getVoucherById: GetVoucherById,
  ) {}

  async execute(code: string, codeStatus?: 'used' | 'unused'): Promise<any> {
    try {
      this.logger.log(
        `[START] Getting voucher by latest code: ${code}, codeStatus: ${codeStatus || 'all'}`,
      );

      const voucherCode = await this.prisma.voucherCode.findUnique({
        where: { code },
        select: {
          id: true,
          code: true,
          pointsCost: true,
          currency: true,
          isUsed: true,
          usedAt: true,
          usedBy: true,
          currentOwnerId: true,
          createdAt: true,
          voucherId: true,
        },
      });

      if (!voucherCode) {
        this.logger.error(`[ERROR] Voucher code ${code} not found`);
        throw new NotFoundException(`Voucher code ${code} not found`);
      }

      const result = await this.getVoucherById.execute(
        voucherCode.voucherId,
        codeStatus,
      );

      this.logger.log(`[SUCCESS] Retrieved voucher for latest code ${code}`);

      return {
        ...result,
        latestCode: {
          id: voucherCode.id,
          code: voucherCode.code,
          pointsCost: voucherCode.pointsCost,
          currency: voucherCode.currency,
          isUsed: voucherCode.isUsed,
          usedAt: voucherCode.usedAt,
          usedBy: voucherCode.usedBy,
          currentOwnerId: voucherCode.currentOwnerId,
          createdAt: voucherCode.createdAt,
        },
      };
    } catch (error) {
      this.logger.error(
        `[FATAL ERROR] Failed to get voucher by latest code: ${error.message}`,
        error.stack,
      );

      if (error instanceof NotFoundException) {
        throw error;
      }

      if (error instanceof InternalServerErrorException) {
        throw error;
      }

      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }
}
