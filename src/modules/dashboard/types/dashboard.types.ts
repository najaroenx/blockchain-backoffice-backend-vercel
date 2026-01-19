// Shared Dashboard Types

export interface DateRangeInfo {
  startDate: string;
  endDate: string;
}

export interface TimeSeriesData {
  period: string; // "2026-01-01" | "2026-W01" | "2026-01"
  label: string; // "Jan 1" | "Week 1" | "January"
}

// ============================================
// Marketer Dashboard Types
// ============================================

export interface MarketerDashboardResponse {
  dateRange: DateRangeInfo;

  // ============================================
  // Section 1: ข้อมูลภาพรวมร้านของตนเอง
  // ============================================

  // 1.1 จำนวนคูปอง
  couponCount: {
    total: number; // จำนวนคูปองทั้งหมดที่เรามี
    purchased: number; // จำนวนคูปองที่ซื้อมาจาก Seller
    soldToEndUser: number; // จำนวนคูปองที่ขายให้ End User
    pendingUse: number; // จำนวนคูปองที่ End User ซื้อแต่ยังไม่ใช้
    redeemed: number; // จำนวนคูปองที่ End User redeem แล้วจริง ๆ
  };

  // 1.2 มูลค่าคูปอง (THB)
  couponValue: {
    total: number; // มูลค่าคูปองทั้งหมดที่เรามี (THB)
    sold: number; // มูลค่าคูปองที่ขายทั้งหมด (THB)
    pendingUse: number; // มูลค่าคูปองที่ End User ซื้อแต่ยังไม่ใช้ (THB)
    redeemed: number; // มูลค่าคูปองที่ End User redeem แล้วจริง ๆ (THB)
  };

  // ============================================
  // Section 2: ข้อมูล End User
  // ============================================
  endUsers: {
    total: number; // จำนวน End User ทั้งหมด
    buyers: number; // จำนวน End User ที่ซื้อคูปอง
    couponsSold: number; // จำนวนคูปองที่ขายให้ End User
    pendingUsers: number; // จำนวน End User ที่ซื้อแต่ยังไม่ใช้
    redeemedUsers: number; // จำนวน End User ที่ redeem แล้วจริง ๆ
  };

  // ============================================
  // Section 3: Transaction
  // ============================================
  transactions: {
    transferPoint: number; // จำนวน Point ที่โอน
    redeemPoint: number; // จำนวน Point ที่ Redeem
  };

  // ============================================
  // Section 4: Point
  // ============================================
  points: {
    total: number; // จำนวน Point ทั้งหมด (initial supply รวม)
    types: string[]; // ประเภท Point ที่มี
  };

  // ============================================
  // Section 5: THB Token
  // ============================================
  thbToken: {
    deposited: number; // THB Token ที่เติมเข้าไป
    usedForPromotion: number; // THB Token ที่ใช้ซื้อคูปองจาก Seller
    usedForRedeem: number; // THB Token สำหรับ redeem
  };
}

// ============================================
// Seller Dashboard Types
// ============================================

/**
 * Coupon count breakdown for seller dashboard
 * - total: Total coupons created by seller (all-time)
 * - owned: Coupons still owned by Seller (not purchased by any merchant) (all-time)
 * - sold: Coupons sold to merchants (filtered by date range)
 * - reservedByMarketer: Coupons merchants hold but not sold to end users (filtered by date range)
 * - redeemedByEndUser: Coupons end users have redeemed (filtered by date range)
 */
export interface SellerCouponCount {
  total: number;
  owned: number;
  sold: number;
  reservedByMarketer: number;
  redeemedByEndUser: number;
}

export interface SellerCouponValue {
  total: number;
  owned: number;
  sold: number;
  reservedByMarketer: number;
  redeemedByEndUser: number;
}

export interface SellerCouponValueWithCurrency extends SellerCouponValue {
  currency: string;
}

export interface SellerOverallSummary {
  couponCount: SellerCouponCount;
  couponValue: SellerCouponValue;
}

export interface SellerMerchantBreakdown {
  merchantId: string;
  merchantName: string;
  couponCount: SellerCouponCount;
  couponValue: SellerCouponValueWithCurrency;
}

export interface SellerDashboardResponse {
  dateRange: DateRangeInfo;
  overallSummary: SellerOverallSummary;
  merchants: SellerMerchantBreakdown[];
}

// ============================================
// MerchantRef Dashboard Types
// ============================================

export interface MerchantRefDashboardResponse {
  dateRange: DateRangeInfo;
  merchantRef: string;

  // Section 1: ข้อมูลภาพรวมร้านของตนเอง
  overview: {
    coupons: {
      purchasedNotUsed: number; // End User ซื้อแต่ยังไม่ใช้
      redeemed: number; // End User redeem แล้วจริง ๆ
    };
  };

  // Section 2: ข้อมูล End User
  endUsers: {
    total: number; // จำนวน customers ที่เรามี
    purchased: number; // คนที่ซื้อ
    couponsSold: number; // จำนวนคูปองที่ขายทั้งหมด
    couponsNotUsed: number; // End User ซื้อแต่ยังไม่ใช้
    couponsRedeemed: number; // End User redeem แล้วจริง ๆ
  };
}
