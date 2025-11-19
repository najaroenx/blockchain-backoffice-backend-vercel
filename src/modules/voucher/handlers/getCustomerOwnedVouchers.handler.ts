import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class GetCustomerOwnedVouchers {
  private logger = new Logger(GetCustomerOwnedVouchers.name);

  constructor(private prisma: PrismaService) {}

  async execute(
    walletAddress: string,
    status?: 'unused' | 'used' | 'all',
    page: number = 1,
    limit: number = 20,
  ) {
    try {
      this.logger.log(
        `[START] Getting owned vouchers for wallet: ${walletAddress}, status: ${status}`,
      );

      // Find customer by wallet address
      const wallet = await this.prisma.wallet.findUnique({
        where: { walletAddress },
        include: { customer: true },
      });

      const customer = wallet?.customer;

      if (!customer) {
        this.logger.error(
          `[ERROR] Customer with wallet ${walletAddress} not found`,
        );
        return {
          walletAddress,
          customerId: null,
          status: status || 'all',
          pagination: { page, limit, total: 0, totalPages: 0 },
          summary: { total: 0, unused: 0, used: 0 },
          vouchers: [],
        };
      }

      const customerId = customer.id;
      this.logger.log(`[START] Customer found: ${customerId}`);

      // Build where clause based on status
      const where: any = {
        currentOwnerId: customerId,
      };

      if (status === 'unused') {
        where.isUsed = false;
      } else if (status === 'used') {
        where.isUsed = true;
      }
      // 'all' = no isUsed filter

      const skip = (page - 1) * limit;

      // Get owned vouchers with details
      const [vouchers, totalCount] = await Promise.all([
        this.prisma.voucherCode.findMany({
          where,
          include: {
            voucher: {
              include: {
                merchant: true,
              },
            },
            transactions: {
              where: {
                receiverId: customerId,
              },
              orderBy: {
                createdAt: 'desc',
              },
              take: 1, // Latest purchase transaction
              include: {
                transactionType: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          skip,
          take: limit,
        }),
        this.prisma.voucherCode.count({ where }),
      ]);

      // Count by status
      const [unusedCount, usedCount] = await Promise.all([
        this.prisma.voucherCode.count({
          where: { currentOwnerId: customerId, isUsed: false },
        }),
        this.prisma.voucherCode.count({
          where: { currentOwnerId: customerId, isUsed: true },
        }),
      ]);

      this.logger.log(
        `[SUCCESS] Found ${vouchers.length} vouchers for wallet ${walletAddress}`,
      );

      return {
        walletAddress,
        customerId,
        status: status || 'all',
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
        summary: {
          total: totalCount,
          unused: unusedCount,
          used: usedCount,
        },
        vouchers: vouchers.map((vc) => {
          const purchaseTransaction = vc.transactions[0];

          return {
            codeId: vc.id,
            code: vc.code,
            isUsed: vc.isUsed,
            usedAt: vc.usedAt,
            pointsCost: vc.pointsCost,
            purchasedAt: purchaseTransaction?.createdAt || vc.createdAt,
            purchaseType:
              purchaseTransaction?.transactionType?.name || 'Unknown',
            voucher: {
              id: vc.voucher.id,
              name: vc.voucher.name,
              description: vc.voucher.description,
              valueType: vc.voucher.valueType,
              value: vc.voucher.value,
              currency: vc.voucher.currency,
              imageUrl: vc.voucher.imageUrl,
              startDate: vc.voucher.startDate,
              endDate: vc.voucher.endDate,
              merchant: {
                id: vc.voucher.merchant?.id,
                name: vc.voucher.merchant?.name || vc.voucher.merchantName,
                imageUrl: vc.voucher.merchant?.imageUrl,
              },
            },
          };
        }),
      };
    } catch (error) {
      this.logger.error(
        `[ERROR] Failed to get owned vouchers: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
