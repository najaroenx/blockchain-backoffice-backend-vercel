import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';
import { MerchantRefEnrichmentService } from 'src/modules/shared/services/merchant-ref-enrichment.service';
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
    private merchantRefEnrichment: MerchantRefEnrichmentService,
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

      const customer = await this.findCustomerWithWallet(phone);
      if (!customer) {
        return this.emptyResponse(status, limit);
      }

      const { id: customerId, walletAddress } = customer;

      const customerCodes = await this.fetchCustomerCodes(customerId);
      const codesByVoucherId = this.indexCodesByVoucher(customerCodes);

      const activeVouchers = await this.fetchActiveVouchersWithTokenIds();
      const balanceMap = await this.fetchOnChainBalances(
        walletAddress,
        activeVouchers,
      );

      const vouchersWithBalance = this.reconcileVouchers(
        activeVouchers,
        balanceMap,
        codesByVoucherId,
        customerCodes,
      );

      const filteredVouchers = this.applyStatusFilter(
        vouchersWithBalance,
        status,
      );

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
      await this.enrichWithMerchantRef(groupedVouchers);

      return {
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        page,
        limit,
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

  /** Find customer by phone with wallet via raw SQL */
  private async findCustomerWithWallet(
    phone: string,
  ): Promise<CustomerRow | null> {
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
      return null;
    }

    this.logger.log(
      `[SUCCESS] Customer found: ${customers[0].id} with wallet ${customers[0].walletAddress}`,
    );
    return customers[0];
  }

  /** Return an empty response shape */
  private emptyResponse(
    status: string | undefined,
    limit: number,
  ): GetCustomerOwnedVouchersResponseType {
    return {
      status: (status || 'all') as 'all' | 'unused' | 'used',
      page: 1,
      limit,
      total: 0,
      totalPages: 0,
      summary: { total: 0, unused: 0, used: 0 },
      vouchers: [],
    };
  }

  /** Fetch all voucher codes owned by a customer via raw SQL */
  private async fetchCustomerCodes(customerId: string) {
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
        COALESCE(v."merchantId", v."sellerMerchantId", mrs.id) AS "voucherMerchantId",
        COALESCE(m.name, sm.name, mrs.name, v."merchantName") AS "voucherMerchantName",
        v."tokenId" AS "voucherTokenId",
        COALESCE(m."imageUrl", sm."imageUrl", mrs."imageUrl") AS "merchantImageUrl",
        COALESCE(m.name, sm.name) AS "merchantDbName",
        t.id AS "txId",
        t."transactionTypeId" AS "txTransactionTypeId"
      FROM "VoucherCode" vc
      JOIN "Voucher" v ON vc."voucherId" = v.id
      LEFT JOIN "Merchant" m ON v."merchantId" = m.id
      LEFT JOIN "Merchant" sm ON v."sellerMerchantId" = sm.id
      LEFT JOIN "MerchantRefStore" mrs ON v."merchantRef" = mrs."merchantRef"
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
    return customerCodes;
  }

  /** Index customer codes by voucherId for fast lookup */
  private indexCodesByVoucher(customerCodes: CustomerCodeRow[]) {
    const codesByVoucherId = new Map<string, CustomerCodeRow[]>();
    for (const row of customerCodes) {
      const existing = codesByVoucherId.get(row.voucherId);
      if (existing) {
        existing.push(row);
      } else {
        codesByVoucherId.set(row.voucherId, [row]);
      }
    }
    return codesByVoucherId;
  }

  /** Fetch active/upcoming vouchers with tokenIds for on-chain balance check */
  private async fetchActiveVouchersWithTokenIds() {
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
        COALESCE(v."merchantId", v."sellerMerchantId", mrs.id) AS "voucherMerchantId",
        COALESCE(m.name, sm.name, mrs.name, v."merchantName") AS "voucherMerchantName",
        COALESCE(m."imageUrl", sm."imageUrl", mrs."imageUrl") AS "merchantImageUrl",
        sample_vc."pointsCost" AS "samplePointsCost",
        sample_vc.currency AS "sampleCurrency"
      FROM "Voucher" v
      LEFT JOIN "Merchant" m ON v."merchantId" = m.id
      LEFT JOIN "Merchant" sm ON v."sellerMerchantId" = sm.id
      LEFT JOIN "MerchantRefStore" mrs ON v."merchantRef" = mrs."merchantRef"
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
    return activeVouchers;
  }

  /** Batch on-chain balance check with individual fallback */
  private async fetchOnChainBalances(
    walletAddress: string,
    activeVouchers: ActiveVoucherRow[],
  ): Promise<Map<string, number>> {
    const tokenIds = activeVouchers.map((v) => Number(v.tokenId));
    if (tokenIds.length === 0) return new Map();

    this.logger.log(
      `[STEP 4] Batch checking ${tokenIds.length} tokenIds on-chain`,
    );

    try {
      const balanceMap = await this.blockchainService.getUserCouponBalanceBatch(
        walletAddress,
        tokenIds,
      );
      this.logger.log(
        `[STEP 4] On-chain balances retrieved for ${balanceMap.size} tokenIds`,
      );
      return balanceMap;
    } catch (err) {
      this.logger.warn(
        `[WARN] Batch balance check failed, falling back to individual calls: ${err.message}`,
      );
      return this.fetchBalancesIndividually(walletAddress, activeVouchers);
    }
  }

  /** Fallback: fetch balances one-by-one in parallel */
  private async fetchBalancesIndividually(
    walletAddress: string,
    activeVouchers: ActiveVoucherRow[],
  ): Promise<Map<string, number>> {
    const balanceMap = new Map<string, number>();
    const results = await Promise.allSettled(
      activeVouchers.map(async (v) => {
        const bal = await this.blockchainService.getUserCouponBalance(
          walletAddress,
          Number(v.tokenId),
        );
        return { tokenId: v.tokenId, balance: parseInt(bal.balance) };
      }),
    );
    for (const r of results) {
      if (r.status === 'fulfilled') {
        balanceMap.set(r.value.tokenId, r.value.balance);
      }
    }
    return balanceMap;
  }

  /** Reconcile on-chain balances with DB codes */
  private reconcileVouchers(
    activeVouchers: ActiveVoucherRow[],
    balanceMap: Map<string, number>,
    codesByVoucherId: Map<string, CustomerCodeRow[]>,
    customerCodes: CustomerCodeRow[],
  ) {
    const vouchersWithBalance: Array<{
      voucher: ReturnType<typeof this.buildVoucherFromActive>;
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
    const addedCodeIds = new Set<string>();

    this.addOnChainVouchers(
      activeVouchers,
      balanceMap,
      codesByVoucherId,
      vouchersWithBalance,
      addedCodeIds,
    );
    this.addRedeemedVouchers(customerCodes, addedCodeIds, vouchersWithBalance);

    this.logger.log(
      `[STEP 5] Total vouchers reconciled: ${vouchersWithBalance.length}`,
    );
    return vouchersWithBalance;
  }

  /** Add vouchers with positive on-chain balance */
  private addOnChainVouchers(
    activeVouchers: ActiveVoucherRow[],
    balanceMap: Map<string, number>,
    codesByVoucherId: Map<string, CustomerCodeRow[]>,
    result: any[],
    addedCodeIds: Set<string>,
  ) {
    for (const av of activeVouchers) {
      const onChainBalance = balanceMap.get(av.tokenId) || 0;
      if (onChainBalance <= 0) continue;

      const codes = codesByVoucherId.get(av.voucherId) || [];
      const unusedCodes = codes.filter((c) => !c.isUsed);

      for (let i = 0; i < onChainBalance; i++) {
        const codeRow = unusedCodes[i] || null;
        result.push({
          voucher: this.buildVoucherFromActive(av),
          code: codeRow ? this.buildCodeShape(codeRow) : null,
          onChainBalance: onChainBalance.toString(),
          pointsCost: codeRow?.pointsCost || av.samplePointsCost || 0,
          currency: codeRow?.currency || av.sampleCurrency || '',
        });
        if (codeRow) addedCodeIds.add(codeRow.codeId);
      }
    }
  }

  /** Add redeemed (used) vouchers from DB that weren't already added */
  private addRedeemedVouchers(
    customerCodes: CustomerCodeRow[],
    addedCodeIds: Set<string>,
    result: any[],
  ) {
    for (const codeRow of customerCodes) {
      if (!codeRow.isUsed || addedCodeIds.has(codeRow.codeId)) continue;
      result.push({
        voucher: this.buildVoucherFromCode(codeRow),
        code: this.buildCodeShape(codeRow),
        onChainBalance: '0',
        pointsCost: codeRow.pointsCost || 0,
        currency: codeRow.currency || '',
      });
      addedCodeIds.add(codeRow.codeId);
    }
  }

  /** Build voucher shape from ActiveVoucherRow */
  private buildVoucherFromActive(v: ActiveVoucherRow) {
    return {
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
    };
  }

  /** Build voucher shape from CustomerCodeRow */
  private buildVoucherFromCode(c: CustomerCodeRow) {
    return {
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
    };
  }

  /** Build code shape from a CustomerCodeRow */
  private buildCodeShape(c: CustomerCodeRow) {
    return {
      id: c.codeId,
      code: c.code,
      voucherGroupId: c.voucherGroupId,
      isUsed: c.isUsed,
      usedAt: c.usedAt,
    };
  }

  /** Apply status filter to vouchers */
  private applyStatusFilter(vouchersWithBalance: any[], status?: string) {
    if (status === 'unused') {
      return vouchersWithBalance.filter((item) => !item.code?.isUsed);
    }
    if (status === 'used') {
      return vouchersWithBalance.filter((item) => item.code?.isUsed);
    }
    return vouchersWithBalance;
  }

  /** Enrich grouped vouchers with MerchantRefStore details */
  private async enrichWithMerchantRef(groupedVouchers: any[]) {
    const merchantRefs = groupedVouchers
      .map((g) => g.latestVoucher.merchantRef)
      .filter((ref): ref is string => !!ref);

    if (merchantRefs.length === 0) return;

    const merchantRefMap =
      await this.merchantRefEnrichment.enrichBatch(merchantRefs);

    for (const group of groupedVouchers) {
      const ref = group.latestVoucher.merchantRef;
      const detail = ref ? merchantRefMap.get(ref) : undefined;
      group.latestVoucher.merchantRefDetail = detail
        ? {
            id: detail.id,
            merchantRef: detail.merchantRef,
            name: detail.name,
            category: detail.category,
            description: detail.description,
            imageUrl: detail.imageUrl,
            locationUrl: detail.locationUrl,
            website: detail.website,
            isActive: detail.isActive,
          }
        : null;
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
