import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';
import { GetCustomerOwnedVouchersResponseType } from '../types';

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
  ): Promise<GetCustomerOwnedVouchersResponseType> {
    try {
      this.logger.log(
        `[START] Getting owned vouchers for phone: ${phone}, status: ${status}`,
      );

      // Find customer by phone (tel field) - same as buyCouponFromMarketplace
      const customer = await this.prisma.customer.findFirst({
        where: { tel: phone },
        include: {
          wallet: true,
        },
      });

      if (!customer || !customer.wallet) {
        this.logger.error(
          `[ERROR] Customer with phone ${phone} not found or has no wallet`,
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

      const customerId = customer.id;
      const walletAddress = customer.wallet.walletAddress;
      this.logger.log(
        `[SUCCESS] Customer found: ${customerId} with wallet ${walletAddress}`,
      );

      // STEP 1: Get all vouchers with NFTs from database (active + upcoming with codes)
      this.logger.log(
        `[STEP 1] Fetching all vouchers with marketplace listings from database`,
      );
      const activeVouchers = await this.prisma.voucher.findMany({
        where: {
          status: { in: ['active', 'upcoming'] },
          tokenId: { not: null },
        },
        include: {
          merchant: true,
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
              currentOwnerId: true,
              createdAt: true,
            },
            take: 1, // Just need one for metadata
          },
        },
      });

      this.logger.log(
        `[STEP 1] Found ${activeVouchers.length} active vouchers to check`,
      );

      // STEP 2: Query on-chain balance for each tokenId
      this.logger.log(
        `[STEP 2] Querying on-chain NFT balances for wallet ${walletAddress}`,
      );

      const vouchersWithBalance = [];

      for (const voucher of activeVouchers) {
        if (!voucher.tokenId) continue;

        try {
          const balance = await this.blockchainService.getUserCouponBalance(
            walletAddress,
            Number(voucher.tokenId),
          );

          const onChainBalance = parseInt(balance.balance);

          if (onChainBalance > 0) {
            this.logger.log(
              `[STEP 2] Wallet has ${onChainBalance} NFTs of tokenId ${voucher.tokenId} (${voucher.name})`,
            );

            // Get voucher codes for this customer
            const customerCodes = await this.prisma.voucherCode.findMany({
              where: {
                voucherId: voucher.id,
                currentOwnerId: customerId,
              },
              include: {
                transactions: {
                  where: {
                    receiverId: customerId,
                    transactionTypeId: 'TRANSFER',
                    type: 'VOUCHER',
                  },
                  orderBy: { createdAt: 'desc' },
                  take: 1,
                  include: {
                    transactionType: true,
                  },
                },
              },
              orderBy: { createdAt: 'desc' },
            });

            // Map each on-chain NFT to database code or create virtual entry
            for (let i = 0; i < onChainBalance; i++) {
              const code = customerCodes[i] || null;
              const sampleCode = voucher.voucherCodes[0];

              vouchersWithBalance.push({
                voucher,
                code,
                onChainBalance: onChainBalance.toString(),
                pointsCost: code?.pointsCost || sampleCode?.pointsCost || 0,
                currency: code?.currency || sampleCode?.currency || '',
                purchaseTransaction: code?.transactions[0] || null,
              });
            }
          }
        } catch (err) {
          this.logger.warn(
            `[WARN] Failed to fetch balance for tokenId ${voucher.tokenId}: ${err.message}`,
          );
        }
      }

      this.logger.log(
        `[STEP 2] Total vouchers with on-chain balance: ${vouchersWithBalance.length}`,
      );

      // STEP 2.5: Add redeemed vouchers (used codes with 0 on-chain balance)
      this.logger.log(
        `[STEP 2.5] Fetching redeemed vouchers for customer ${customerId}`,
      );

      const redeemedCodes = await this.prisma.voucherCode.findMany({
        where: {
          currentOwnerId: customerId,
          isUsed: true,
        },
        include: {
          voucher: {
            include: {
              merchant: true,
            },
          },
          transactions: {
            where: {
              receiverId: customerId,
              transactionTypeId: { in: ['TRANSFER', 'REDEEM'] },
              type: 'VOUCHER',
            },
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: {
              transactionType: true,
            },
          },
        },
      });

      this.logger.log(
        `[STEP 2.5] Found ${redeemedCodes.length} redeemed vouchers`,
      );

      // Add redeemed codes that are not already in the list
      const existingCodeIds = new Set(
        vouchersWithBalance.map((item) => item.code?.id).filter(Boolean),
      );

      for (const code of redeemedCodes) {
        if (!existingCodeIds.has(code.id)) {
          vouchersWithBalance.push({
            voucher: code.voucher,
            code: code,
            onChainBalance: '0', // Already redeemed/burned
            pointsCost: code.pointsCost || 0,
            currency: code.currency || '',
            purchaseTransaction: code.transactions[0] || null,
          });
        }
      }

      this.logger.log(
        `[STEP 2.5] Total vouchers (including redeemed): ${vouchersWithBalance.length}`,
      );

      // STEP 3: Apply status filter
      let filteredVouchers = vouchersWithBalance;

      if (status === 'unused') {
        filteredVouchers = vouchersWithBalance.filter(
          (item) => !item.code?.isUsed,
        );
      } else if (status === 'used') {
        filteredVouchers = vouchersWithBalance.filter(
          (item) => item.code?.isUsed,
        );
      }

      this.logger.log(
        `[STEP 3] After status filter (${status}): ${filteredVouchers.length} vouchers`,
      );

      // STEP 4: Apply pagination
      const totalCount = filteredVouchers.length;
      const skip = (page - 1) * limit;
      const paginatedVouchers = filteredVouchers.slice(skip, skip + limit);

      // Count by status
      const unusedCount = vouchersWithBalance.filter(
        (item) => !item.code?.isUsed,
      ).length;
      const usedCount = vouchersWithBalance.filter(
        (item) => item.code?.isUsed,
      ).length;

      this.logger.log(
        `[SUCCESS] Returning ${paginatedVouchers.length} vouchers (page ${page}, limit ${limit})`,
      );

      this.logger.log(
        `[SUCCESS] Returning ${paginatedVouchers.length} vouchers (page ${page}, limit ${limit})`,
      );

      // Group vouchers by voucherGroupId and status (like getCustomerPhoneDevForResp)
      const groupedVouchers = this.groupVouchersByGroupId(paginatedVouchers);

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
        vouchers: groupedVouchers,
      };
    } catch (error) {
      this.logger.error(
        `[ERROR] Failed to get owned vouchers: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Group vouchers by voucherGroupId and status
   * Same logic as getCustomerPhoneDevForResp.handler.ts
   */
  private groupVouchersByGroupId(vouchersWithBalance: any[]): any[] {
    const groupedMap = new Map<string, any>();
    const now = new Date();

    for (const item of vouchersWithBalance) {
      const { voucher, code, onChainBalance, pointsCost, currency } = item;

      const groupId = code?.voucherGroupId;
      const isExpired = voucher.endDate && new Date(voucher.endDate) < now;

      // Determine status: expired > used > unused
      let codeStatus = 'unused';
      if (isExpired) {
        codeStatus = 'expired';
      } else if (code?.isUsed) {
        codeStatus = 'used';
      }

      const key = `${groupId}|${codeStatus}`;

      if (!groupedMap.has(key)) {
        groupedMap.set(key, {
          voucherGroupId: groupId,
          latestVoucher: {
            id: voucher.id,
            name: voucher.name,
            description: voucher.description,
            imageUrl: voucher.imageUrl || null,
            value: voucher.value,
            valueType: voucher.valueType,
            status: voucher.status,
            startDate: voucher.startDate,
            endDate: voucher.endDate,
            merchantRef: voucher.merchantRef || null,
            merchantId: voucher.merchantId || voucher.merchant?.id || null,
            merchantName:
              voucher.merchantName || voucher.merchant?.name || null,
            merchantImageUrl: voucher.merchant?.imageUrl || null,
            latestCode: code?.code || null,
            codeStatus: codeStatus,
            pointsCost: pointsCost || 0,
            currency: currency || null,
            onChainBalance: onChainBalance,
          },
          totalCodes: 0,
        });
      }

      const group = groupedMap.get(key);

      // Set latestCode to the first code encountered (since we already ordered by createdAt desc)
      if (!group.latestVoucher.latestCode && code?.code) {
        group.latestVoucher.latestCode = code.code;
      }

      group.totalCodes += 1;
    }

    return Array.from(groupedMap.values());
  }
}
