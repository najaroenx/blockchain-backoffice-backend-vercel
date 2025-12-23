import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class GetVoucherByMerchantRef {
  private logger = new Logger(GetVoucherByMerchantRef.name);
  constructor(private readonly prisma: PrismaService) {}

  async execute(merchantRef: string) {
    try {
      const voucher = await this.prisma.voucher.findFirst({
        where: {
          merchantRef: merchantRef,
        },
        include: {
          merchant: {
            select: {
              id: true,
              name: true,
              wallet: {
                select: {
                  walletAddress: true,
                },
              },
            },
          },
          voucherCodes: {
            where: {
              isUsed: true,
            },
            select: {
              id: true,
              voucherGroupId: true,
              isUsed: true,
              currentOwnerId: true,
              pointId: true,
              point: {
                select: {
                  id: true,
                  name: true,
                  symbol: true,
                  imageUrl: true,
                },
              },
            },
          },
        },
      });

      if (!voucher) {
        throw new NotFoundException(
          `Voucher with merchantRef ${merchantRef} not found`,
        );
      }
      const response = {
        id: voucher.id,
        name: voucher.name,
        description: voucher.description,
        merchant: voucher.merchant,
        amount: voucher.voucherCodes.length * voucher.value,
        voucherCodes: voucher.voucherCodes,
      };
      return response;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        `Error fetching voucher with merchantRef ${merchantRef}:`,
        error,
      );
      throw new InternalServerErrorException('Error fetching voucher');
    }
  }
}
