// Shared Dashboard Types

export interface DateRangeInfo {
  startDate: string;
  endDate: string;
}

export interface TimeSeriesData {
  period: string; // "2026-01-01" | "2026-W01" | "2026-01"
  label: string; // "Jan 1" | "Week 1" | "January"
}

// Shared Coupon Stats Interface
export interface CouponStats {
  total: number; // จำนวน/มูลค่าคูปองทั้งหมดที่เรามี
  unsold: number; // จำนวน/มูลค่าคูปองที่ยังไม่ลงขาย
  sold: number; // จำนวน/มูลค่าคูปองที่ลงขายแล้ว
  pendingUse: number; // จำนวน/มูลค่าคูปองที่ End User ซื้อแต่ยังไม่ใช้
  redeemed: number; // จำนวน/มูลค่าคูปองที่ End User redeem แล้วจริง ๆ
}

export interface CouponStatsWithCurrency extends CouponStats {
  currency: string; // สกุลเงินของคูปอง (Point symbol)
}

// Shared Point Info Interface
export interface PointInfo {
  symbol: string; // สัญลักษณ์ Point (e.g., "PTS", "COIN")
  total: number; // จำนวน Point ทั้งหมด (initial supply)
  balance: number; // จำนวน Point ที่เหลืออยู่ (current balance)
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
  couponCount: CouponStats;

  // 1.2 มูลค่าคูปอง (THB)
  couponValue: CouponStats;

  // 1.3 มูลค่าคูปองแยกตามสกุลเงิน (Point)
  couponValueByCurrency: CouponStatsWithCurrency[];

  // ============================================
  // Section 2: ข้อมูล End User
  // ============================================
  endUsers: {
    total: number; // จำนวน End User ทั้งหมด
    pendingUsers: number; // จำนวน End User ที่ซื้อแต่ยังไม่ใช้
    redeemedUsers: number; // จำนวน End User ที่ redeem แล้วจริง ๆ
  };

  // ============================================
  // Section 3: Transaction
  // ============================================
  transactions: {
    transferPoint: number; // จำนวน ครั้งที่ transfer Point ระหว่าง End User
    purchaseCoupon: number; // จำนวน ครั้งที่ End User ใช้ Point ซื้อคูปอง
  };

  // ============================================
  // Section 4: Point
  // ============================================
  points: PointInfo[];

  // ============================================
  // Section 5: THB Token
  // ============================================
  thbToken: {
    deposited: number; // THB Token ที่เติมเข้าไป
    balance: number; // THB Token คงเหลือ
    bought: number; // THB Token ที่ใช้ซื้อคูปองจาก Seller
  };
}

// ============================================
// Seller Dashboard Types
// ============================================

export interface SellerCouponCount {
  total: number;
  unsold: number;
  sold: number;
  unreserved: number;
  reserved: number;
  unredeemed: number;
  redeemed: number;
}

export interface SellerCouponValue {
  sold: number;
  unreserved: number;
  reserved: number;
  unredeemed: number;
  redeemed: number;
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
  couponValue: SellerCouponValue;
}

export interface SellerDashboardResponse {
  dateRange: DateRangeInfo;
  overallSummary: SellerOverallSummary;
  merchants: SellerMerchantBreakdown[];
}

// ============================================
// MerchantRef Dashboard Types
// ============================================

export interface MerchantRefCouponSummary {
  total: number; // จำนวนคูปองที่ขายให้ End User
  pendingUse: number; // จำนวนคูปองที่ End User ซื้อแต่ยังไม่ใช้
  redeemed: number; // จำนวนคูปองที่ End User redeem แล้วจริง ๆ
}

export interface MerchantRefEndUserSummary {
  total: number; // จำนวน End User ทั้งหมด
  pendingUsers: number; // จำนวน End User ที่ซื้อแต่ยังไม่ใช้
  redeemedUsers: number; // จำนวน End User ที่ redeem แล้ว
}

export interface MerchantRefMerchantSummary {
  coupon: MerchantRefCouponSummary;
  endUser: MerchantRefEndUserSummary;
}

export interface MerchantRefDashboardResponse {
  dateRange: DateRangeInfo;
  merchantRef: string;
  myMerchantSummary: MerchantRefMerchantSummary;
}
