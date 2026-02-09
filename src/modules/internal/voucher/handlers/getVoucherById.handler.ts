import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';

@Injectable()
export class GetVoucherById {
  private logger = new Logger(GetVoucherById.name);

  constructor(private prisma: PrismaService) {}

  async execute(voucherId: string): Promise<any> {
    try {
      this.logger.log(`[START] Getting voucher by id: ${voucherId}`);

      // Get voucher by ID with all related data
      const voucher = await this.prisma.voucher.findUnique({
        where: { id: voucherId },
        include: {
          merchant: {
            select: {
              id: true,
              name: true,
              description: true,
              imageUrl: true,
              website: true,
            },
          },
          voucherCodes: {
            where: {
              voucherGroupId: { not: null }, // Only activated codes
            },
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
            },
          },
        },
      });

      if (!voucher) {
        this.logger.error(`[ERROR] Voucher with id ${voucherId} not found`);
        throw new NotFoundException(`Voucher with id ${voucherId} not found`);
      }

      // Get latest code (sorted by createdAt desc, first one is latest)
      const sortedCodes = voucher.voucherCodes.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      const latestCode = sortedCodes[0] || null;

      const result = {
        id: voucher.id,
        name: voucher.name,
        description: voucher.description,
        imageUrl: voucher.imageUrl,
        status: voucher.status,
        valueType: voucher.valueType,
        value: voucher.value,
        currency: voucher.currency,
        startDate: voucher.startDate,
        endDate: voucher.endDate,
        tokenId: voucher.tokenId,
        totalRedeemed: voucher.totalRedeemed,
        merchantId: voucher.merchantId,
        merchantName: voucher.merchantName,
        merchantRef: voucher.merchantRef,
        createdAt: voucher.createdAt,
        updatedAt: voucher.updatedAt,
        merchant: voucher.merchant,
        latestCode: latestCode
          ? {
              id: latestCode.id,
              code: latestCode.code,
              pointsCost: latestCode.pointsCost,
              currency: latestCode.currency,
              isUsed: latestCode.isUsed,
              usedAt: latestCode.usedAt,
              usedBy: latestCode.usedBy,
              currentOwnerId: latestCode.currentOwnerId,
              createdAt: latestCode.createdAt,
            }
          : null,
        totalCodes: voucher.voucherCodes.length,
      };

      this.logger.log(
        `[SUCCESS] Retrieved voucher ${voucherId} with ${voucher.voucherCodes.length} codes`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `[FATAL ERROR] Failed to get voucher: ${error.message}`,
        error.stack,
      );

      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }
}
