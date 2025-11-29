import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';

@Injectable()
export class GetCustomerOwnedVouchers {
  private logger = new Logger(GetCustomerOwnedVouchers.name);

  constructor(
    private prisma: PrismaService,
    private blockchainService: BlockchainService,
  ) {}

  async execute(
    phone: string,
    status?: 'unused' | 'used' | 'all',
    page: number = 1,
    limit: number = 20,
  ) {
    try {
      this.logger.log(
        `[START] Getting owned vouchers for phone: ${phone}, status: ${status}`,
      );

      // Find wallet by phone and type customer
      const wallet = await this.prisma.wallet.findFirst({
        where: { phoneNumber: phone, type: 'customer' },
        include: { customer: true },
      });

      if (!wallet || !wallet.customer) {
        this.logger.error(
          `[ERROR] Customer wallet with phone ${phone} not found`,
        );
        return {
          phone,
          walletAddress: null,
          customerId: null,
          status: status || 'all',
          pagination: { page, limit, total: 0, totalPages: 0 },
          summary: { total: 0, unused: 0, used: 0 },
          vouchers: [],
        };
      }

      const customerId = wallet.customer.id;
      const walletAddress = wallet.walletAddress;
      this.logger.log(
        `[START] Customer found: ${customerId} with wallet ${walletAddress}`,
      );

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
        `[SUCCESS] Found ${vouchers.length} vouchers for phone ${phone}`,
      );

      // Fetch on-chain balances for unique tokenIds
      const tokenIds = Array.from(
        new Set(
          vouchers
            .map((vc) => vc.voucher?.tokenId)
            .filter((tid): tid is string => Boolean(tid)),
        ),
      );

      const onChainBalanceMap = new Map<string, string | null>();

      for (const tokenId of tokenIds) {
        try {
          const balance = await this.blockchainService.getUserCouponBalance(
            walletAddress,
            Number(tokenId),
          );
          onChainBalanceMap.set(tokenId, balance.balance);
        } catch (err) {
          this.logger.warn(
            `[WARN] Failed to fetch on-chain balance for tokenId ${tokenId}: ${err.message}`,
          );
          onChainBalanceMap.set(tokenId, null);
        }
      }

      return {
        phone,
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
          const tokenId = vc.voucher?.tokenId;

          return {
            codeId: vc.id,
            code: vc.code,
            isUsed: vc.isUsed,
            usedAt: vc.usedAt,
            pointsCost: vc.pointsCost,
            purchasedAt: purchaseTransaction?.createdAt || vc.createdAt,
            purchaseType:
              purchaseTransaction?.transactionType?.name || 'Unknown',
            onChainBalance:
              tokenId && onChainBalanceMap.has(tokenId)
                ? onChainBalanceMap.get(tokenId)
                : null,
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
              merchantRef: vc.voucher.merchantRef,
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
