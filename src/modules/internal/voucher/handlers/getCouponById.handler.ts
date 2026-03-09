import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';
import { MerchantRefEnrichmentService } from 'src/modules/shared/services/merchant-ref-enrichment.service';

@Injectable()
export class GetCouponById {
  private logger = new Logger(GetCouponById.name);

  constructor(
    private prisma: PrismaService,
    private merchantRefEnrichment: MerchantRefEnrichmentService,
  ) {}

  async execute(couponId: string): Promise<any> {
    try {
      this.logger.log(`[START] Getting coupon by id: ${couponId}`);

      // Get VoucherCode by ID with related voucher, merchant, and point
      const voucherCode = await this.prisma.voucherCode.findUnique({
        where: { id: couponId },
        include: {
          voucher: {
            select: {
              id: true,
              name: true,
              description: true,
              imageUrl: true,
              valueType: true,
              value: true,
              currency: true,
              status: true,
              startDate: true,
              endDate: true,
              tokenId: true,
              merchantId: true,
              merchantName: true,
              merchantRef: true,
              thbPurchasePrice: true,
            },
          },
          point: {
            select: {
              id: true,
              name: true,
              symbol: true,
              imageUrl: true,
            },
          },
        },
      });

      if (!voucherCode) {
        this.logger.error(`[ERROR] Coupon with id ${couponId} not found`);
        throw new NotFoundException(`Coupon with id ${couponId} not found`);
      }

      const merchantRefDetail = voucherCode.voucher?.merchantRef
        ? await this.merchantRefEnrichment.enrich(voucherCode.voucher.merchantRef)
        : null;

      // Get merchant info if voucher has merchantId
      let merchant = null;
      if (voucherCode.voucher?.merchantId) {
        merchant = await this.prisma.merchant.findUnique({
          where: { id: voucherCode.voucher.merchantId },
          select: {
            id: true,
            name: true,
            imageUrl: true,
            description: true,
          },
        });
      }

      const result = {
        id: voucherCode.id,
        code: voucherCode.code,
        pointsCost: voucherCode.pointsCost,
        thbPrice: voucherCode.thbPrice,
        currency: voucherCode.currency,
        isUsed: voucherCode.isUsed,
        usedAt: voucherCode.usedAt,
        usedBy: voucherCode.usedBy,
        currentOwnerId: voucherCode.currentOwnerId,
        currentOwnerType: voucherCode.currentOwnerType,
        voucherGroupId: voucherCode.voucherGroupId,
        listingBatchId: voucherCode.listingBatchId,
        createdAt: voucherCode.createdAt,
        voucher: voucherCode.voucher
          ? {
              id: voucherCode.voucher.id,
              name: voucherCode.voucher.name,
              description: voucherCode.voucher.description,
              imageUrl: voucherCode.voucher.imageUrl,
              valueType: voucherCode.voucher.valueType,
              value: voucherCode.voucher.value,
              currency: voucherCode.voucher.currency,
              status: voucherCode.voucher.status,
              startDate: voucherCode.voucher.startDate,
              endDate: voucherCode.voucher.endDate,
              tokenId: voucherCode.voucher.tokenId,
              merchantRef: voucherCode.voucher.merchantRef,
              merchantRefDetail,
              thbPurchasePrice: voucherCode.voucher.thbPurchasePrice,
            }
          : null,
        merchant,
        point: voucherCode.point
          ? {
              id: voucherCode.point.id,
              name: voucherCode.point.name,
              symbol: voucherCode.point.symbol,
              imageUrl: voucherCode.point.imageUrl,
            }
          : null,
      };

      this.logger.log(`[SUCCESS] Retrieved coupon ${couponId}`);

      return result;
    } catch (error) {
      this.logger.error(
        `[FATAL ERROR] Failed to get coupon: ${error.message}`,
        error.stack,
      );

      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }
}
