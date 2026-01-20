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

  couponValueByCurrency: {
    currency: string; // สกุลเงินของคูปอง
    total: number; // มูลค่าคูปองทั้งหมดที่เรามี (สกุลเงินนั้น ๆ)
    sold: number; // มูลค่าคูปองที่ขายทั้งหมด (สกุลเงินนั้น ๆ)
    pendingUse: number; // มูลค่าคูปองที่ End User ซื้อแต่ยังไม่ใช้ (สกุลเงินนั้น ๆ)
    redeemed: number; // มูลค่าคูปองที่ End User redeem แล้วจริง ๆ (สกุลเงินนั้น ๆ)
  }[];

  // ============================================
  // Section 2: ข้อมูล End User
  // ============================================
  endUsers: {
    buyers: number; // จำนวน End User ที่ซื้อคูปอง
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
  points: {
    total: number; // จำนวน Point ทั้งหมด (initial supply รวม)
    types: string;
  }[];

  // ============================================
  // Section 5: THB Token
  // ============================================
  thbToken: {
    deposited: number; // THB Token ที่เติมเข้าไป
    usedForPromotion: number; // THB Token ที่ใช้ซื้อคูปองจาก Seller
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
  soldToEndUser: number; // จำนวนคูปองที่ขายให้ End User
  pendingUse: number; // จำนวนคูปองที่ End User ซื้อแต่ยังไม่ใช้
  redeemed: number; // จำนวนคูปองที่ End User redeem แล้วจริง ๆ
}

export interface MerchantRefEndUserSummary {
  total: number; // จำนวน End User ทั้งหมด
  buyers: number; // จำนวน End User ที่ซื้อคูปอง
  couponsSold: number; // จำนวนคูปองที่ขายให้ End User
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
