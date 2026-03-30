import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';

const VOUCHER_TOKEN_ID_START = 10000;

@Injectable()
export class ResetVoucherTokenIds {
  private readonly logger = new Logger(ResetVoucherTokenIds.name);

  constructor(private readonly prisma: PrismaService) {}

  async execute(): Promise<{
    success: true;
    message: string;
    updatedCount: number;
    startTokenId: string | null;
    endTokenId: string | null;
  }> {
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const vouchers = await tx.voucher.findMany({
          select: {
            id: true,
          },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        });

        if (vouchers.length === 0) {
          return {
            updatedCount: 0,
            startTokenId: null,
            endTokenId: null,
          };
        }

        await tx.voucher.updateMany({
          data: {
            tokenId: null,
          },
        });

        for (const [index, voucher] of vouchers.entries()) {
          await tx.voucher.update({
            where: { id: voucher.id },
            data: {
              tokenId: String(VOUCHER_TOKEN_ID_START + index),
            },
          });
        }

        return {
          updatedCount: vouchers.length,
          startTokenId: String(VOUCHER_TOKEN_ID_START),
          endTokenId: String(VOUCHER_TOKEN_ID_START + vouchers.length - 1),
        };
      });

      this.logger.warn(
        `[Admin] Reset Voucher tokenId running from ${result.startTokenId ?? '-'} to ${result.endTokenId ?? '-'} for ${result.updatedCount} record(s)`,
      );

      return {
        success: true,
        message: 'All voucher tokenId values have been reset successfully',
        updatedCount: result.updatedCount,
        startTokenId: result.startTokenId,
        endTokenId: result.endTokenId,
      };
    } catch (error) {
      this.logger.error(
        `Error message : ${error.message}, \n Error detail : ${error}`,
      );
      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }
}
