import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';
import { TransactionTypeId } from 'src/constants/transaction-types.enum';
import { DashboardQueryDto } from '../dtos/dashboard-query.dto';
import {
  SellerDashboardResponse,
  SellerOverallSummary,
  SellerMerchantBreakdown,
  DateRangeInfo,
  CouponDropdownResponse,
  SellerMerchantsResponse,
} from '../types/dashboard.types';
import { startOfMonth, endOfDay, startOfDay, format } from 'date-fns';

/**
 * Handler สำหรับดึงข้อมูล Seller Dashboard
 *
 * แสดงสถิติคูปองของ Seller ประกอบด้วย:
 * - overallSummary: สรุปภาพรวมคูปองทั้งหมดของ seller
 * - merchants: รายละเอียดคูปองที่แต่ละ Marketer ซื้อไป
 *
 * Logic การนับ (Hierarchical):
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │ total = unsold + sold                                              │
 * │   ├─ unsold = not-listed (VoucherCode สร้างแล้วแต่ยังไม่ list)     │
 * │   └─ sold = list แล้ว = unreserved + reserved                      │
 * │        ├─ unreserved: List แล้วแต่ยังไม่มีคนซื้อ                   │
 * │        └─ reserved: Marketer ซื้อแล้ว = unredeemed + redeemed      │
 * │             ├─ unredeemed: End User ยังไม่ redeem                  │
 * │             └─ redeemed: End User redeem แล้ว                      │
 * └─────────────────────────────────────────────────────────────────────┘
 */
@Injectable()
export class GetSellerDashboardHandler {
  private logger = new Logger(GetSellerDashboardHandler.name);

  constructor(private readonly prisma: PrismaService) {}

  // =====================================================
  // Shared: Wallet lookup (2 DB calls → 1 raw SQL)
  // =====================================================
  /**
   * Find seller wallet address from merchant ID using a single SQL JOIN
   * Replaces: 1) wallet.findFirst(merchant) + 2) wallet.findFirst(seller)
   */
  private async findSellerWalletAddress(
    merchantId: string,
  ): Promise<string | null> {
    const result = await this.prisma.$queryRaw<
      [{ sellerWalletAddress: string }?]
    >`
      SELECT sw."walletAddress" AS "sellerWalletAddress"
      FROM "Wallet" mw
      JOIN "Merchant" m ON m."walletId" = mw.id
      JOIN "Wallet" sw ON sw."phoneNumber" = mw."phoneNumber"
        AND sw."derivationIndex" = mw."derivationIndex" + 1
        AND sw.type = 'seller'
      WHERE m.id = ${merchantId}
      LIMIT 1
    `;

    return result[0]?.sellerWalletAddress?.toLowerCase() ?? null;
  }

  async execute(
    merchantId: string,
    query: DashboardQueryDto,
  ): Promise<SellerDashboardResponse> {
    try {
      this.logger.log(
        `[START] Getting seller dashboard for merchant: ${merchantId}`,
      );

      const dateRange = this.parseDateRange(query);

      // =====================================================
      // Step 1: หา Seller Wallet จาก Merchant ID (1 DB call instead of 2)
      // =====================================================
      const sellerWalletAddress =
        await this.findSellerWalletAddress(merchantId);

      if (!sellerWalletAddress) {
        this.logger.log(
          `[INFO] Seller wallet not found for merchant ${merchantId}`,
        );
        return { dateRange, ...this.getEmptyResponse() };
      }

      this.logger.log(`[INFO] Found seller wallet: ${sellerWalletAddress}`);

      // =====================================================
      // Step 2: ดึง VoucherCode + Voucher metadata ทั้งหมดด้วย CTE (was 3 queries, now 1)
      // =====================================================
      // CTE combines: voucher.findMany + listingBatch.findMany + voucherCode.findMany
      const allVoucherCodes = await this.prisma.$queryRaw<
        Array<{
          id: string;
          voucherId: string;
          thbPrice: number | null;
          isUsed: boolean;
          listingBatchId: string | null;
          currentOwnerId: string | null;
          currentOwnerType: string | null;
          voucherThbPurchasePrice: number | null;
        }>
      >`
        WITH seller_vouchers AS (
          SELECT id, "totalIssued", "thbPurchasePrice"
          FROM "Voucher"
          WHERE "sellerMerchantId" = ${merchantId}
        ),
        seller_batches AS (
          SELECT id
          FROM "ListingBatch"
          WHERE lower("sellerWalletAddress") = ${sellerWalletAddress}
        )
        SELECT
          vc.id,
          vc."voucherId",
          vc."thbPrice",
          vc."isUsed",
          vc."listingBatchId",
          vc."currentOwnerId",
          vc."currentOwnerType",
          v."thbPurchasePrice" AS "voucherThbPurchasePrice"
        FROM "VoucherCode" vc
        JOIN "Voucher" v ON vc."voucherId" = v.id
        WHERE vc."voucherId" IN (SELECT id FROM seller_vouchers)
           OR vc."listingBatchId" IN (SELECT id FROM seller_batches)
      `;

      // Get voucher metadata for not-listed calculation (totalIssued)
      const vouchersFromSeller = await this.prisma.$queryRaw<
        Array<{
          id: string;
          totalIssued: number;
          thbPurchasePrice: number | null;
        }>
      >`
        SELECT id, "totalIssued", "thbPurchasePrice"
        FROM "Voucher"
        WHERE "sellerMerchantId" = ${merchantId}
      `;

      this.logger.log(
        `[DEBUG] Total voucher codes found: ${allVoucherCodes.length}`,
      );

      // Check if there are any vouchers with totalIssued (not-listed) even if no codes exist yet
      const totalExpectedFromSeller = vouchersFromSeller.reduce(
        (sum, v) => sum + v.totalIssued,
        0,
      );

      if (allVoucherCodes.length === 0 && totalExpectedFromSeller === 0) {
        this.logger.log(`[INFO] No voucher codes found for seller`);
        return { dateRange, ...this.getEmptyResponse() };
      }

      // Get sold code IDs for THB_BUY lookup
      const soldCodes = allVoucherCodes.filter((vc) => vc.listingBatchId);
      const soldCodeIds = soldCodes.map((vc) => vc.id);

      // =====================================================
      // Step 3: หา THB_BUY transactions (1 DB call)
      // =====================================================
      const reservedCodeMap = new Map<string, string>();
      if (soldCodeIds.length > 0) {
        const thbBuyTransactions = await this.prisma.$queryRaw<
          Array<{ merchantId: string; voucherCodeId: string }>
        >`
          SELECT "merchantId", "voucherCodeId"
          FROM "Transaction"
          WHERE "transactionTypeId" = ${TransactionTypeId.THB_BUY}
            AND type = 'THB_TOKEN'::"AssetType"
            AND "voucherCodeId" IN (${Prisma.join(soldCodeIds)})
            AND "merchantId" IS NOT NULL
            AND "voucherCodeId" IS NOT NULL
        `;

        for (const tx of thbBuyTransactions) {
          reservedCodeMap.set(tx.voucherCodeId, tx.merchantId);
        }
      }

      // =====================================================
      // Step 4: คำนวณสถิติ (in-memory, same logic as before)
      // =====================================================
      // Map raw SQL rows to the format expected by calculateOverallSummary
      const mappedCodes = allVoucherCodes.map((vc) => ({
        id: vc.id,
        voucherId: vc.voucherId,
        thbPrice: vc.thbPrice,
        isUsed: vc.isUsed,
        listingBatchId: vc.listingBatchId,
        currentOwnerId: vc.currentOwnerId,
        currentOwnerType: vc.currentOwnerType,
        voucher: { thbPurchasePrice: vc.voucherThbPurchasePrice },
      }));

      const overallSummary = this.calculateOverallSummary(
        mappedCodes,
        reservedCodeMap,
        vouchersFromSeller,
      );

      this.logger.log(
        `[SUCCESS] Seller dashboard retrieved for merchant: ${merchantId}`,
      );

      return {
        dateRange,
        overallSummary,
      };
    } catch (error) {
      this.logger.error(
        `[ERROR] Failed to get seller dashboard: ${error.message}`,
        error.stack,
      );

      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }

  private parseDateRange(query: DashboardQueryDto): DateRangeInfo {
    const now = new Date();
    const startDate = query.startDate
      ? startOfDay(new Date(query.startDate))
      : startOfMonth(now);
    const endDate = query.endDate
      ? endOfDay(new Date(query.endDate))
      : endOfDay(now);

    return {
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd'),
    };
  }

  private getEmptyResponse(): Omit<SellerDashboardResponse, 'dateRange'> {
    return {
      overallSummary: {
        couponCount: {
          total: 0,
          unsold: 0,
          sold: 0,
          unreserved: 0,
          reserved: 0,
          unredeemed: 0,
          redeemed: 0,
        },
        couponValue: {
          total: 0,
          unsold: 0,
          sold: 0,
          unreserved: 0,
          reserved: 0,
          unredeemed: 0,
          redeemed: 0,
        },
      },
    };
  }

  /**
   * Calculate overall summary across all voucher codes
   *
   * Logic (hierarchical):
   * - total = unsold + sold (คูปองทั้งหมดที่ seller มี รวม not-listed)
   * - unsold = ยังไม่ list = not-listed (VoucherCode สร้างแล้วแต่ยังไม่ list)
   * - sold = list แล้ว = unreserved + reserved
   * - unreserved = List แล้วแต่ยังไม่มี Marketer ซื้อ
   * - reserved = Marketer ซื้อแล้ว = unredeemed + redeemed
   * - unredeemed = Marketer ซื้อแล้วแต่ End User ยังไม่ redeem
   * - redeemed = End User redeem แล้ว (isUsed = true)
   */
  private calculateOverallSummary(
    voucherCodes: Array<{
      id: string;
      voucherId: string;
      thbPrice: number | null;
      isUsed: boolean;
      listingBatchId: string | null;
      currentOwnerId: string | null;
      currentOwnerType: string | null; // 'marketer' | 'customer' | null
      voucher: {
        thbPurchasePrice: number | null;
      } | null;
    }>,
    reservedCodeMap: Map<string, string>, // voucherCodeId -> merchantId
    vouchersFromSeller: Array<{
      id: string;
      totalIssued: number;
      thbPurchasePrice: number | null;
    }>,
  ): SellerOverallSummary {
    let unsold = 0;
    let sold = 0;
    let unreserved = 0;
    let reserved = 0;
    let unredeemed = 0;
    let redeemed = 0;

    let unsoldValue = 0;
    let soldValue = 0;
    let unreservedValue = 0;
    let reservedValue = 0;
    let unredeemedValue = 0;
    let redeemedValue = 0;

    // Calculate not-listed count (vouchers created but VoucherCodes not yet minted)
    // Count how many VoucherCodes exist per voucher
    const createdCodesPerVoucher = new Map<string, number>();
    for (const vc of voucherCodes) {
      const count = createdCodesPerVoucher.get(vc.voucherId) || 0;
      createdCodesPerVoucher.set(vc.voucherId, count + 1);
    }

    // Calculate not-listed from totalIssued - actual codes created
    let notListedCount = 0;
    let notListedValue = 0;
    for (const v of vouchersFromSeller) {
      const actualCodes = createdCodesPerVoucher.get(v.id) || 0;
      const notListed = Math.max(0, v.totalIssued - actualCodes);
      notListedCount += notListed;
      notListedValue += notListed * (v.thbPurchasePrice || 0);
    }

    // Add not-listed to unsold
    unsold += notListedCount;
    unsoldValue += notListedValue;

    for (const vc of voucherCodes) {
      const price = vc.thbPrice ?? vc.voucher?.thbPurchasePrice ?? 0;
      const isListed = vc.listingBatchId !== null;
      const isReserved = reservedCodeMap.has(vc.id);
      const isRedeemed = vc.isUsed;
      const hasOwner = vc.currentOwnerId !== null;

      if (!isListed) {
        // ยังไม่ list on marketplace (VoucherCode สร้างแล้วแต่ยังไม่ list)
        unsold++;
        unsoldValue += price;
      } else if (!hasOwner) {
        // Listed on marketplace แต่ยังไม่มีคนซื้อ (available on marketplace)
        sold++;
        soldValue += price;
        unreserved++;
        unreservedValue += price;
      } else {
        // มีคนซื้อแล้ว (Marketer หรือ Customer)
        sold++;
        soldValue += price;

        if (isReserved) {
          // Marketer ซื้อแล้ว
          reserved++;
          reservedValue += price;

          if (!isRedeemed) {
            // End User ยังไม่ redeem
            unredeemed++;
            unredeemedValue += price;
          } else {
            // End User redeem แล้ว
            redeemed++;
            redeemedValue += price;
          }
        }
      }
    }

    const total = unsold + sold;
    const totalValue = unsoldValue + soldValue;

    return {
      couponCount: {
        total,
        unsold,
        sold,
        unreserved,
        reserved,
        unredeemed,
        redeemed,
      },
      couponValue: {
        total: totalValue,
        unsold: unsoldValue,
        sold: soldValue,
        unreserved: unreservedValue,
        reserved: reservedValue,
        unredeemed: unredeemedValue,
        redeemed: redeemedValue,
      },
    };
  }

  /**
   * คำนวณ breakdown ต่อ Marketer ที่ซื้อคูปองจาก Seller
   *
   * แสดงเฉพาะ reserved codes (codes ที่ Marketer ซื้อแล้ว)
   *
   * Output:
   * - couponCount.total: จำนวนคูปองทั้งหมดที่ Marketer จอง
   * - couponCount.unredeemed: จำนวนที่ End User ยังไม่ redeem
   * - couponCount.redeemed: จำนวนที่ End User redeem แล้ว
   * - couponValue.total: มูลค่ารวม (THB)
   * - couponValue.unredeemed: มูลค่าที่ยังไม่ redeem
   * - couponValue.redeemed: มูลค่าที่ redeem แล้ว
   */
  private calculateMerchantBreakdown(
    soldCodes: Array<{
      id: string;
      thbPrice: number | null;
      isUsed: boolean;
      listingBatchId: string | null;
      voucher: { thbPurchasePrice: number | null } | null;
    }>,
    reservedCodeMap: Map<string, string>, // voucherCodeId -> merchantId
    merchantMap: Map<string, string>, // merchantId -> name
  ): SellerMerchantBreakdown[] {
    // Group voucher codes by merchant (only reserved codes)
    const merchantGroups = new Map<
      string,
      Array<{
        id: string;
        thbPrice: number | null;
        isUsed: boolean;
        voucher: { thbPurchasePrice: number | null } | null;
      }>
    >();

    for (const vc of soldCodes) {
      const merchantId = reservedCodeMap.get(vc.id);
      if (!merchantId) continue; // Skip unreserved codes

      if (!merchantGroups.has(merchantId)) {
        merchantGroups.set(merchantId, []);
      }
      merchantGroups.get(merchantId)!.push(vc);
    }

    // Calculate stats per merchant
    const result: SellerMerchantBreakdown[] = [];

    for (const [merchantId, codes] of merchantGroups) {
      let unredeemed = 0;
      let redeemed = 0;
      let unredeemedValue = 0;
      let redeemedValue = 0;

      for (const vc of codes) {
        const price = vc.thbPrice ?? vc.voucher?.thbPurchasePrice ?? 0;
        const isRedeemed = vc.isUsed;

        if (!isRedeemed) {
          unredeemed++;
          unredeemedValue += price;
        } else {
          redeemed++;
          redeemedValue += price;
        }
      }

      const totalValue = codes.reduce(
        (sum, vc) => sum + (vc.thbPrice ?? vc.voucher?.thbPurchasePrice ?? 0),
        0,
      );

      result.push({
        merchantId,
        merchantName: merchantMap.get(merchantId) || 'Unknown',
        couponCount: {
          total: codes.length, // คูปองทั้งหมดที่ Marketer จอง
          unredeemed, // End User ยังไม่ redeem
          redeemed, // End User redeem แล้ว
        },
        couponValue: {
          total: totalValue, // มูลค่าคูปองทั้งหมดที่ Marketer จอง
          unredeemed: unredeemedValue, // มูลค่า End User ยังไม่ redeem
          redeemed: redeemedValue, // มูลค่า End User redeem แล้ว
        },
      });
    }

    // Sort by total value descending
    result.sort((a, b) => b.couponValue.total - a.couponValue.total);

    return result;
  }

  /**
   * Get coupon dropdown list for seller
   * - Without marketerMerchantId: returns ALL coupons created by this seller
   * - With marketerMerchantId: returns only coupons from this seller that the marketer bought
   * @param sellerMerchantId - The seller's merchant ID
   * @param marketerMerchantId - Optional marketer's merchant ID to filter by
   */
  async getCouponDropdown(
    sellerMerchantId: string,
    marketerMerchantId?: string,
  ): Promise<CouponDropdownResponse> {
    this.logger.log(
      `[START] Getting seller coupon dropdown for seller: ${sellerMerchantId}, marketer: ${marketerMerchantId || 'all'}`,
    );

    if (!marketerMerchantId) {
      // No marketer filter: return all coupons created by this seller
      const vouchers = await this.prisma.voucher.findMany({
        where: { sellerMerchantId },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      });

      this.logger.log(
        `[SUCCESS] Found ${vouchers.length} coupons for seller dropdown (all)`,
      );

      return { coupons: vouchers };
    }

    // With marketer filter: find coupons created by this seller that the marketer bought
    const thbBuyTransactions = await this.prisma.transaction.findMany({
      where: {
        merchantId: marketerMerchantId,
        transactionTypeId: TransactionTypeId.THB_BUY,
        voucherCodeId: { not: null },
      },
      select: {
        voucherCode: {
          select: {
            voucherId: true,
            voucher: {
              select: { sellerMerchantId: true },
            },
          },
        },
      },
    });

    // Filter to only coupons created by THIS seller
    const purchasedVoucherIds = [
      ...new Set(
        thbBuyTransactions
          .map((tx) => tx.voucherCode)
          .filter((vc) => vc?.voucher?.sellerMerchantId === sellerMerchantId)
          .map((vc) => vc!.voucherId)
          .filter((id): id is string => !!id),
      ),
    ];

    if (purchasedVoucherIds.length === 0) {
      this.logger.log(
        `[SUCCESS] No seller coupons found for marketer ${marketerMerchantId}`,
      );
      return { coupons: [] };
    }

    const vouchers = await this.prisma.voucher.findMany({
      where: { id: { in: purchasedVoucherIds } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    this.logger.log(
      `[SUCCESS] Found ${vouchers.length} seller coupons for marketer ${marketerMerchantId} dropdown`,
    );

    return { coupons: vouchers };
  }

  /**
   * Get merchants (marketers) breakdown for seller
   * Optimized: 7 DB calls → 3 (wallet lookup + codes/txns + merchant names)
   * @param couponIds - Optional filter by specific voucher IDs
   */
  async getMerchants(
    merchantId: string,
    couponIds?: string[],
  ): Promise<SellerMerchantsResponse> {
    this.logger.log(
      `[START] Getting merchants breakdown for seller: ${merchantId}`,
    );

    // Step 1: Find seller wallet (1 DB call instead of 2)
    const sellerWalletAddress = await this.findSellerWalletAddress(merchantId);

    if (!sellerWalletAddress) {
      this.logger.log(`[INFO] Seller wallet not found for ${merchantId}`);
      return { merchants: [] };
    }

    const hasCouponFilter = couponIds && couponIds.length > 0;

    // Step 2: Get sold voucher codes + THB_BUY merchant mapping in 1 query (was 5 queries)
    // CTE: seller_vouchers → seller_batches → sold codes → join THB_BUY transactions
    const soldCodesWithMerchant = await this.prisma.$queryRaw<
      Array<{
        id: string;
        voucherId: string;
        thbPrice: number | null;
        isUsed: boolean;
        listingBatchId: string | null;
        currentOwnerId: string | null;
        currentOwnerType: string | null;
        voucherThbPurchasePrice: number | null;
        buyerMerchantId: string | null;
      }>
    >`
      WITH seller_vouchers AS (
        SELECT id
        FROM "Voucher"
        WHERE "sellerMerchantId" = ${merchantId}
          ${hasCouponFilter ? Prisma.sql`AND id IN (${Prisma.join(couponIds!)})` : Prisma.empty}
      ),
      seller_batches AS (
        SELECT id
        FROM "ListingBatch"
        WHERE lower("sellerWalletAddress") = ${sellerWalletAddress}
      ),
      sold_codes AS (
        SELECT
          vc.id, vc."voucherId", vc."thbPrice", vc."isUsed",
          vc."listingBatchId", vc."currentOwnerId", vc."currentOwnerType",
          v."thbPurchasePrice" AS "voucherThbPurchasePrice"
        FROM "VoucherCode" vc
        JOIN "Voucher" v ON vc."voucherId" = v.id
        WHERE vc."listingBatchId" IS NOT NULL
          ${hasCouponFilter ? Prisma.sql`AND vc."voucherId" IN (${Prisma.join(couponIds!)})` : Prisma.empty}
          AND (
            vc."voucherId" IN (SELECT id FROM seller_vouchers)
            OR vc."listingBatchId" IN (SELECT id FROM seller_batches)
          )
      )
      SELECT
        sc.*,
        t."merchantId" AS "buyerMerchantId"
      FROM sold_codes sc
      LEFT JOIN "Transaction" t ON t."voucherCodeId" = sc.id
        AND t."transactionTypeId" = ${TransactionTypeId.THB_BUY}
        AND t.type = 'THB_TOKEN'::"AssetType"
    `;

    if (soldCodesWithMerchant.length === 0) {
      return { merchants: [] };
    }

    // Build reservedCodeMap from the joined data
    const reservedCodeMap = new Map<string, string>();
    for (const row of soldCodesWithMerchant) {
      if (row.buyerMerchantId && row.id) {
        reservedCodeMap.set(row.id, row.buyerMerchantId);
      }
    }

    // Step 3: Get merchant names (1 DB call)
    const merchantIds = [...new Set(reservedCodeMap.values())];

    if (merchantIds.length === 0) {
      return { merchants: [] };
    }

    const merchants = await this.prisma.merchant.findMany({
      where: { id: { in: merchantIds } },
      select: { id: true, name: true },
    });
    const merchantMap = new Map(merchants.map((m) => [m.id, m.name]));

    // Map raw SQL rows to the format expected by calculateMerchantBreakdown
    const mappedCodes = soldCodesWithMerchant.map((vc) => ({
      id: vc.id,
      thbPrice: vc.thbPrice,
      isUsed: vc.isUsed,
      listingBatchId: vc.listingBatchId,
      voucher: { thbPurchasePrice: vc.voucherThbPurchasePrice },
    }));

    // Step 4: Calculate merchant breakdown (in-memory)
    const merchantBreakdown = this.calculateMerchantBreakdown(
      mappedCodes,
      reservedCodeMap,
      merchantMap,
    );

    this.logger.log(
      `[SUCCESS] Found ${merchantBreakdown.length} merchants for seller`,
    );

    return { merchants: merchantBreakdown };
  }
}
