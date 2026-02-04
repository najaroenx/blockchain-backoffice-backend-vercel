import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';
import { TransactionTypeId } from 'src/constants/transaction-types.enum';
import { AssetType } from '@prisma/client';
import { DashboardQueryDto } from '../dtos/dashboard-query.dto';
import {
  SellerDashboardResponse,
  SellerOverallSummary,
  SellerMerchantBreakdown,
  DateRangeInfo,
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
 * │   ├─ unsold = not-listed + listed-but-unsold                       │
 * │   │    ├─ not-listed: Voucher สร้างแล้วแต่ยังไม่ mint VoucherCode  │
 * │   │    └─ listed-but-unsold: List แล้วแต่ยังไม่มีคนซื้อ            │
 * │   └─ sold = reserved (Marketer ซื้อแล้ว)                           │
 * │        ├─ unredeemed: End User ยังไม่ redeem                       │
 * │        └─ redeemed: End User redeem แล้ว                           │
 * └─────────────────────────────────────────────────────────────────────┘
 */
@Injectable()
export class GetSellerDashboardHandler {
  private logger = new Logger(GetSellerDashboardHandler.name);

  constructor(private readonly prisma: PrismaService) {}

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
      // Step 1: หา Seller Wallet จาก Merchant ID
      // =====================================================
      // Seller wallet มี derivationIndex = merchantWallet.derivationIndex + 1
      // และใช้ phoneNumber เดียวกัน, type = 'seller'
      const merchantWallet = await this.prisma.wallet.findFirst({
        where: {
          merchant: { id: merchantId },
        },
        select: {
          phoneNumber: true,
          derivationIndex: true,
        },
      });

      if (!merchantWallet) {
        this.logger.log(`[INFO] Merchant wallet not found for ${merchantId}`);
        return { dateRange, ...this.getEmptyResponse() };
      }

      // Find seller wallet (derivationIndex + 1, same phoneNumber)
      const sellerWallet = await this.prisma.wallet.findFirst({
        where: {
          phoneNumber: merchantWallet.phoneNumber,
          derivationIndex: merchantWallet.derivationIndex + 1,
          type: 'seller',
        },
        select: {
          walletAddress: true,
        },
      });

      if (!sellerWallet) {
        this.logger.log(
          `[INFO] Seller wallet not found for merchant ${merchantId}`,
        );
        return { dateRange, ...this.getEmptyResponse() };
      }

      const sellerWalletAddress = sellerWallet.walletAddress.toLowerCase();
      this.logger.log(`[INFO] Found seller wallet: ${sellerWalletAddress}`);

      // Debug: Check all ListingBatches in DB
      const allListingBatches = await this.prisma.listingBatch.findMany({
        select: { id: true, sellerWalletAddress: true },
        take: 10,
      });
      this.logger.log(
        `[DEBUG] Sample ListingBatches in DB: ${JSON.stringify(allListingBatches)}`,
      );

      // =====================================================
      // Step 2: ดึง VoucherCode ทั้งหมดของ Seller
      // =====================================================
      // ใช้ 2 strategies:
      // - Strategy 1: Vouchers ที่ seller สร้างเอง (sellerMerchantId = merchantId)
      // - Strategy 2: VoucherCodes ที่ seller list บน marketplace (ListingBatch)

      // Strategy 1: ดึง Vouchers ที่ seller สร้าง พร้อม totalIssued และ thbPurchasePrice
      // - totalIssued: จำนวน voucher ที่ตั้งไว้ตอนสร้าง (ใช้คำนวณ not-listed)
      // - thbPurchasePrice: ราคา THB ต่อ unit (ใช้คำนวณ value)
      const vouchersFromSeller = await this.prisma.voucher.findMany({
        where: { sellerMerchantId: merchantId },
        select: { id: true, totalIssued: true, thbPurchasePrice: true },
      });
      const voucherIdsFromSeller = vouchersFromSeller.map((v) => v.id);
      this.logger.log(
        `[DEBUG] Vouchers with sellerMerchantId: ${voucherIdsFromSeller.length}`,
      );

      // Strategy 2: ดึง ListingBatches ที่ seller list บน marketplace
      // ใช้ sellerWalletAddress เป็นตัวระบุว่า seller คนไหน list
      const listingBatches = await this.prisma.listingBatch.findMany({
        where: {
          sellerWalletAddress: {
            equals: sellerWalletAddress,
            mode: 'insensitive',
          },
        },
        select: { id: true },
      });
      const listingBatchIds = listingBatches.map((lb) => lb.id);
      this.logger.log(
        `[DEBUG] ListingBatches from seller: ${listingBatchIds.length}`,
      );

      // รวม VoucherCodes จากทั้ง 2 strategies
      // - voucherId: ใช้นับจำนวน codes ที่สร้างแล้วต่อ voucher (สำหรับคำนวณ not-listed)
      // - currentOwnerId: ใช้เช็คว่ามีคนซื้อหรือยัง (null = seller ยังเป็นเจ้าของ)
      // - thbPrice: ราคาที่ list บน marketplace
      // - voucher.thbPurchasePrice: ราคา fallback ถ้าไม่มี thbPrice
      const allVoucherCodes = await this.prisma.voucherCode.findMany({
        where: {
          OR: [
            // Codes from vouchers created by seller
            ...(voucherIdsFromSeller.length > 0
              ? [{ voucherId: { in: voucherIdsFromSeller } }]
              : []),
            // Codes listed by seller on marketplace
            ...(listingBatchIds.length > 0
              ? [{ listingBatchId: { in: listingBatchIds } }]
              : []),
          ],
        },
        select: {
          id: true,
          voucherId: true,
          thbPrice: true,
          isUsed: true,
          listingBatchId: true,
          currentOwnerId: true,
          voucher: {
            select: {
              thbPurchasePrice: true,
            },
          },
        },
      });

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

      // Separate unsold (no listingBatchId) and sold (has listingBatchId)
      const unsoldCodes = allVoucherCodes.filter((vc) => !vc.listingBatchId);
      const soldCodes = allVoucherCodes.filter((vc) => vc.listingBatchId);
      const soldCodeIds = soldCodes.map((vc) => vc.id);

      // =====================================================
      // Step 3: หา THB_BUY transactions เพื่อระบุว่า Marketer ซื้อ code ไหน
      // =====================================================
      // THB_BUY = transaction ที่ Marketer ซื้อ coupon จาก Seller
      // ใช้ระบุว่า code ไหนถูก "reserved" โดย Marketer คนไหน
      const thbBuyTransactions = await this.prisma.transaction.findMany({
        where: {
          transactionTypeId: TransactionTypeId.THB_BUY,
          type: AssetType.THB_TOKEN,
          voucherCodeId: { in: soldCodeIds },
        },
        select: {
          merchantId: true,
          voucherCodeId: true,
          amount: true,
        },
      });

      // สร้าง Map: voucherCodeId -> merchantId (Marketer ที่ซื้อไป)
      // ใช้สำหรับ:
      // 1. นับจำนวน reserved codes
      // 2. แยก breakdown ตาม Marketer
      const reservedCodeMap = new Map<string, string>();
      for (const tx of thbBuyTransactions) {
        if (tx.voucherCodeId && tx.merchantId) {
          reservedCodeMap.set(tx.voucherCodeId, tx.merchantId);
        }
      }

      // =====================================================
      // Step 4: ดึงข้อมูล Merchant สำหรับ breakdown
      // =====================================================
      const merchantIds = [...new Set(reservedCodeMap.values())];
      const merchants = await this.prisma.merchant.findMany({
        where: { id: { in: merchantIds } },
        select: { id: true, name: true },
      });
      const merchantMap = new Map(merchants.map((m) => [m.id, m.name]));

      // =====================================================
      // Step 5: คำนวณสถิติ
      // =====================================================
      // overallSummary: สรุปภาพรวม (total, unsold, sold, reserved, unredeemed, redeemed)
      // merchantBreakdown: แยกตาม Marketer (total, unredeemed, redeemed)
      const overallSummary = this.calculateOverallSummary(
        allVoucherCodes,
        reservedCodeMap,
        vouchersFromSeller,
      );

      const merchantBreakdown = this.calculateMerchantBreakdown(
        soldCodes,
        reservedCodeMap,
        merchantMap,
      );

      this.logger.log(
        `[SUCCESS] Seller dashboard retrieved for merchant: ${merchantId}`,
      );

      return {
        dateRange,
        overallSummary,
        merchants: merchantBreakdown,
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
      merchants: [],
    };
  }

  /**
   * Calculate overall summary across all voucher codes
   *
   * Logic (hierarchical):
   * - total = unsold + sold (คูปองทั้งหมดที่ seller มี รวม not-listed)
   * - unsold = ยังไม่ขาย = not-listed (ยังไม่สร้าง VoucherCode) + listed but unsold (ไม่มี currentOwnerId)
   * - sold = Marketer ซื้อแล้ว = reserved = unredeemed + redeemed
   * - unreserved = 0 (ย้ายไปรวมใน unsold แล้ว)
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
        // Listed on marketplace แต่ยังไม่มีคนซื้อ (seller ยังเป็นเจ้าของ)
        unsold++;
        unsoldValue += price;
        // Also count as unreserved for backward compatibility
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
}
