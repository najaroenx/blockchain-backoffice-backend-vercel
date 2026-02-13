import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';
import { GetCustomerOwnedVouchersResponseType } from '../types';

// Raw SQL result types
interface CustomerRow {
  id: string;
  tel: string;
  walletAddress: string;
}

interface CustomerCodeRow {
  codeId: string;
  code: string;
  voucherGroupId: string | null;
  pointsCost: number;
  currency: string | null;
  isUsed: boolean;
  usedAt: Date | null;
  codeCreatedAt: Date;
  voucherId: string;
  voucherName: string;
  voucherDescription: string;
  voucherImageUrl: string | null;
  voucherValue: number;
  voucherValueType: string;
  voucherStatus: string;
  voucherStartDate: Date;
  voucherEndDate: Date;
  voucherMerchantRef: string | null;
  voucherMerchantId: string | null;
  voucherMerchantName: string;
  voucherTokenId: string | null;
  merchantImageUrl: string | null;
  merchantDbName: string | null;
  txId: string | null;
  txTransactionTypeId: string | null;
}

interface ActiveVoucherRow {
  voucherId: string;
  tokenId: string;
  voucherName: string;
  voucherDescription: string;
  voucherImageUrl: string | null;
  voucherValue: number;
  voucherValueType: string;
  voucherStatus: string;
  voucherStartDate: Date;
  voucherEndDate: Date;
  voucherMerchantRef: string | null;
  voucherMerchantId: string | null;
  voucherMerchantName: string;
  merchantImageUrl: string | null;
  samplePointsCost: number | null;
  sampleCurrency: string | null;
}

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

      // STEP 1: Find customer by phone with wallet (single SQL)
      const customers = await this.prisma.$queryRaw<CustomerRow[]>`
        SELECT c.id, c.tel, w."walletAddress"
        FROM "Customer" c
        JOIN "Wallet" w ON c."walletId" = w.id
        WHERE c.tel = ${phone}
        LIMIT 1
      `;

      if (!customers.length) {
        this.logger.error(
          `[ERROR] Customer with phone ${phone} not found or has no wallet`,
        );
        return {
          phone,
          walletAddress: null,
          customerId: null,
          status: status || 'all',
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
          summary: { total: 0, unused: 0, used: 0 },
          vouchers: [],
        };
      }

      const { id: customerId, walletAddress } = customers[0];
      this.logger.log(
        `[SUCCESS] Customer found: ${customerId} with wallet ${walletAddress}`,
      );

      // STEP 2: Get ALL voucher codes owned by this customer in one query
      // Joins VoucherCode → Voucher → Merchant + lateral join for latest transaction
      this.logger.log(
        `[STEP 2] Fetching all customer-owned voucher codes via raw SQL`,
      );
      const customerCodes = await this.prisma.$queryRaw<CustomerCodeRow[]>`
        SELECT
          vc.id AS "codeId",
          vc.code,
          vc."voucherGroupId",
          vc."pointsCost",
          vc.currency,
          vc."isUsed",
          vc."usedAt",
          vc.created_at AS "codeCreatedAt",
          v.id AS "voucherId",
          v.name AS "voucherName",
          v.description AS "voucherDescription",
          v."imageUrl" AS "voucherImageUrl",
          v.value AS "voucherValue",
          v."valueType" AS "voucherValueType",
          v.status AS "voucherStatus",
          v."startDate" AS "voucherStartDate",
          v."endDate" AS "voucherEndDate",
          v."merchantRef" AS "voucherMerchantRef",
          v."merchantId" AS "voucherMerchantId",
          v."merchantName" AS "voucherMerchantName",
          v."tokenId" AS "voucherTokenId",
          m."imageUrl" AS "merchantImageUrl",
          m.name AS "merchantDbName",
          t.id AS "txId",
          t."transactionTypeId" AS "txTransactionTypeId"
        FROM "VoucherCode" vc
        JOIN "Voucher" v ON vc."voucherId" = v.id
        LEFT JOIN "Merchant" m ON v."merchantId" = m.id
        LEFT JOIN LATERAL (
          SELECT t2.id, t2."transactionTypeId"
          FROM "Transaction" t2
          WHERE t2."voucherCodeId" = vc.id
            AND t2."receiverId" = ${customerId}
            AND t2."transactionTypeId" IN ('TRANSFER', 'REDEEM')
            AND t2.type = 'VOUCHER'
          ORDER BY t2.created_at DESC
          LIMIT 1
        ) t ON true
        WHERE vc."currentOwnerId" = ${customerId}
          AND vc."currentOwnerType" = 'CUSTOMER'
        ORDER BY vc.created_at DESC
      `;

      this.logger.log(
        `[STEP 2] Found ${customerCodes.length} customer-owned voucher codes`,
      );

      // Index customer codes by voucherId for fast lookup
      const codesByVoucherId = new Map<string, CustomerCodeRow[]>();
      const allOwnedCodeIds = new Set<string>();
      for (const row of customerCodes) {
        allOwnedCodeIds.add(row.codeId);
        if (!codesByVoucherId.has(row.voucherId)) {
          codesByVoucherId.set(row.voucherId, []);
        }
        codesByVoucherId.get(row.voucherId)!.push(row);
      }

      // STEP 3: Get all active/upcoming vouchers with tokenIds for on-chain balance check
      this.logger.log(
        `[STEP 3] Fetching active vouchers with tokenIds for on-chain check`,
      );
      const activeVouchers = await this.prisma.$queryRaw<ActiveVoucherRow[]>`
        SELECT
          v.id AS "voucherId",
          v."tokenId",
          v.name AS "voucherName",
          v.description AS "voucherDescription",
          v."imageUrl" AS "voucherImageUrl",
          v.value AS "voucherValue",
          v."valueType" AS "voucherValueType",
          v.status AS "voucherStatus",
          v."startDate" AS "voucherStartDate",
          v."endDate" AS "voucherEndDate",
          v."merchantRef" AS "voucherMerchantRef",
          v."merchantId" AS "voucherMerchantId",
          v."merchantName" AS "voucherMerchantName",
          m."imageUrl" AS "merchantImageUrl",
          sample_vc."pointsCost" AS "samplePointsCost",
          sample_vc.currency AS "sampleCurrency"
        FROM "Voucher" v
        LEFT JOIN "Merchant" m ON v."merchantId" = m.id
        LEFT JOIN LATERAL (
          SELECT vc2."pointsCost", vc2.currency
          FROM "VoucherCode" vc2
          WHERE vc2."voucherId" = v.id AND vc2."voucherGroupId" IS NOT NULL
          LIMIT 1
        ) sample_vc ON true
        WHERE v.status IN ('active', 'upcoming')
          AND v."tokenId" IS NOT NULL
      `;

      this.logger.log(
        `[STEP 3] Found ${activeVouchers.length} active vouchers to check on-chain`,
      );

      // STEP 4: Batch on-chain balance check (single RPC call)
      const tokenIds = activeVouchers.map((v) => Number(v.tokenId));
      let balanceMap = new Map<string, number>();

      if (tokenIds.length > 0) {
        this.logger.log(
          `[STEP 4] Batch checking ${tokenIds.length} tokenIds on-chain`,
        );
        try {
          balanceMap = await this.blockchainService.getUserCouponBalanceBatch(
            walletAddress,
            tokenIds,
          );
        } catch (err) {
          this.logger.warn(
            `[WARN] Batch balance check failed, falling back to individual calls: ${err.message}`,
          );
          // Fallback: parallel individual calls
          const results = await Promise.allSettled(
            activeVouchers.map(async (v) => {
              const bal = await this.blockchainService.getUserCouponBalance(
                walletAddress,
                Number(v.tokenId),
              );
              return {
                tokenId: v.tokenId,
                balance: parseInt(bal.balance),
              };
            }),
          );
          for (const r of results) {
            if (r.status === 'fulfilled') {
              balanceMap.set(r.value.tokenId, r.value.balance);
            }
          }
        }
      }

      this.logger.log(
        `[STEP 4] On-chain balances retrieved for ${balanceMap.size} tokenIds`,
      );

      // STEP 5: Reconcile on-chain balances with DB codes
      const vouchersWithBalance: Array<{
        voucher: {
          id: string;
          name: string;
          description: string;
          imageUrl: string | null;
          value: number;
          valueType: string;
          status: string;
          startDate: Date;
          endDate: Date;
          merchantRef: string | null;
          merchantId: string | null;
          merchantName: string | null;
          merchantImageUrl: string | null;
        };
        code: {
          id: string;
          code: string;
          voucherGroupId: string | null;
          isUsed: boolean;
          usedAt: Date | null;
        } | null;
        onChainBalance: string;
        pointsCost: number;
        currency: string;
      }> = [];

      // Helper to build voucher shape from ActiveVoucherRow
      const buildVoucherFromActive = (v: ActiveVoucherRow) => ({
        id: v.voucherId,
        name: v.voucherName,
        description: v.voucherDescription,
        imageUrl: v.voucherImageUrl,
        value: v.voucherValue,
        valueType: v.voucherValueType,
        status: v.voucherStatus,
        startDate: v.voucherStartDate,
        endDate: v.voucherEndDate,
        merchantRef: v.voucherMerchantRef,
        merchantId: v.voucherMerchantId,
        merchantName: v.voucherMerchantName,
        merchantImageUrl: v.merchantImageUrl,
      });

      // Helper to build voucher shape from CustomerCodeRow
      const buildVoucherFromCode = (c: CustomerCodeRow) => ({
        id: c.voucherId,
        name: c.voucherName,
        description: c.voucherDescription,
        imageUrl: c.voucherImageUrl,
        value: c.voucherValue,
        valueType: c.voucherValueType,
        status: c.voucherStatus,
        startDate: c.voucherStartDate,
        endDate: c.voucherEndDate,
        merchantRef: c.voucherMerchantRef,
        merchantId: c.voucherMerchantId,
        merchantName: c.voucherMerchantName,
        merchantImageUrl: c.merchantImageUrl,
      });

      // Track which codes have been added (to avoid duplicates with redeemed codes)
      const addedCodeIds = new Set<string>();

      // For each active voucher with on-chain balance > 0, map to DB codes
      for (const av of activeVouchers) {
        const onChainBalance = balanceMap.get(av.tokenId) || 0;
        if (onChainBalance <= 0) continue;

        const codes = codesByVoucherId.get(av.voucherId) || [];
        // Filter to unused codes for on-chain mapping
        const unusedCodes = codes.filter((c) => !c.isUsed);

        for (let i = 0; i < onChainBalance; i++) {
          const codeRow = unusedCodes[i] || null;

          vouchersWithBalance.push({
            voucher: buildVoucherFromActive(av),
            code: codeRow
              ? {
                  id: codeRow.codeId,
                  code: codeRow.code,
                  voucherGroupId: codeRow.voucherGroupId,
                  isUsed: codeRow.isUsed,
                  usedAt: codeRow.usedAt,
                }
              : null,
            onChainBalance: onChainBalance.toString(),
            pointsCost: codeRow?.pointsCost || av.samplePointsCost || 0,
            currency: codeRow?.currency || av.sampleCurrency || '',
          });

          if (codeRow) addedCodeIds.add(codeRow.codeId);
        }
      }

      // Add redeemed (used) vouchers from DB that weren't already added
      for (const codeRow of customerCodes) {
        if (codeRow.isUsed && !addedCodeIds.has(codeRow.codeId)) {
          vouchersWithBalance.push({
            voucher: buildVoucherFromCode(codeRow),
            code: {
              id: codeRow.codeId,
              code: codeRow.code,
              voucherGroupId: codeRow.voucherGroupId,
              isUsed: codeRow.isUsed,
              usedAt: codeRow.usedAt,
            },
            onChainBalance: '0',
            pointsCost: codeRow.pointsCost || 0,
            currency: codeRow.currency || '',
          });
          addedCodeIds.add(codeRow.codeId);
        }
      }

      this.logger.log(
        `[STEP 5] Total vouchers reconciled: ${vouchersWithBalance.length}`,
      );

      // STEP 6: Apply status filter
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
        `[STEP 6] After status filter (${status}): ${filteredVouchers.length} vouchers`,
      );

      // STEP 7: Apply pagination
      const totalCount = filteredVouchers.length;
      const skip = (page - 1) * limit;
      const paginatedVouchers = filteredVouchers.slice(skip, skip + limit);

      const unusedCount = vouchersWithBalance.filter(
        (item) => !item.code?.isUsed,
      ).length;
      const usedCount = vouchersWithBalance.filter(
        (item) => item.code?.isUsed,
      ).length;

      this.logger.log(
        `[SUCCESS] Returning ${paginatedVouchers.length} vouchers (page ${page}, limit ${limit})`,
      );

      const groupedVouchers = this.groupVouchersByGroupId(paginatedVouchers);

      return {
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        page,
        limit,
        phone,
        walletAddress,
        customerId,
        status: status || 'all',
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
            merchantId: voucher.merchantId || null,
            merchantName: voucher.merchantName || null,
            merchantImageUrl: voucher.merchantImageUrl || null,
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
