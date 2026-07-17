// Shared Dashboard Types

export interface DateRangeInfo {
  startDate: string;
  endDate: string;
}

// Shared Coupon Stats Interface
export interface CouponStats {
  total: number; // จำนวน/มูลค่าคูปองทั้งหมดที่เรามี
  unsold: number; // จำนวน/มูลค่าคูปองที่ยังไม่ลงขาย
  sold: number; // จำนวน/มูลค่าคูปองที่ลงขายแล้ว
  unredeemed: number; // จำนวน/มูลค่าคูปองที่ End User ซื้อแต่ยังไม่ใช้
  redeemed: number; // จำนวน/มูลค่าคูปองที่ End User redeem แล้วจริง ๆ
}

export interface CouponStatsWithCurrency extends CouponStats {
  currency: string; // สกุลเงินของคูปอง (Point symbol)
}

// Shared Point Info Interface
export interface PointInfo {
  symbol: string; // สัญลักษณ์ Point (e.g., "PTS", "COIN")
  total: number; // จำนวน Point ทั้งหมด (initial supply)
  balance: string; // จำนวน Point ที่เหลืออยู่ (current balance) - string to preserve precision
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
    unredeemedUsers: number; // จำนวน End User ที่ซื้อแต่ยังไม่ใช้
    redeemedUsers: number; // จำนวน End User ที่ redeem แล้วจริง ๆ
  };

  // ============================================
  // Section 3: Transaction
  // ============================================
  transactions: {
    transferPoint: number; // จำนวน ครั้ง transfer Point ระหว่าง End User
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
  total: number; // จำนวนคูปองทั้งหมด
  unsold: number; // จำนวนคูปองที่ยังไม่ลงขาย
  sold: number; // จำนวนคูปองที่ลงขายแล้ว
  unreserved: number; //  จำนวนคูปองที่ ยังไม่ถูก Marketer จอง
  reserved: number; // จำนวนคูปองที่ Marketer จองไว้
  unredeemed: number; // จำนวนคูปองที่ End User ยังไม่ redeem
  redeemed: number; // จำนวนคูปองที่ End User redeem แล้ว
}
export interface SellerCouponValue {
  total: number; // มูลค่าคูปองทั้งหมด
  unsold: number; // มูลค่าคูปองที่ยังไม่ลงขาย
  sold: number; // มูลค่าคูปองที่ลงขายแล้ว
  unreserved: number; //  มูลค่าคูปอง thb token ที่ ยังไม่ถูก Marketer จอง
  reserved: number; // มูลค่าคูปอง thb token ที่ Marketer จองไว้
  unredeemed: number; // มูลค่าคูปอง thb token ที่ End User ยังไม่ redeem
  redeemed: number; // มูลค่าคูปอง thb token ที่ End User redeem แล้ว
}

export interface SellerCouponValueWithCurrency extends SellerCouponValue {
  currency: string;
}

export interface SellerOverallSummary {
  couponCount: SellerCouponCount;
  couponValue: SellerCouponValue;
}

// Simplified interface for merchant breakdown (only reserved/sold coupons)
export interface SellerMerchantCouponCount {
  total: number; // คูปองทั้งหมดที่ Marketer จอง (= unredeemed + redeemed)
  unredeemed: number; // End User ยังไม่ redeem
  redeemed: number; // End User redeem แล้ว
}

export interface SellerMerchantCouponValue {
  total: number; // มูลค่าคูปองทั้งหมดที่ Marketer จอง (= unredeemed + redeemed)
  unredeemed: number; // มูลค่า End User ยังไม่ redeem
  redeemed: number; // มูลค่า End User redeem แล้ว
}

export interface SellerMerchantBreakdown {
  merchantId: string;
  merchantName: string;
  couponCount: SellerMerchantCouponCount;
  couponValue: SellerMerchantCouponValue;
}

export interface SellerDashboardResponse {
  dateRange: DateRangeInfo;
  overallSummary: SellerOverallSummary;
}

// Response for GET /dashboard/seller/:merchantId/merchants
export interface SellerMerchantsResponse {
  merchants: SellerMerchantBreakdown[];
}

// ============================================
// MerchantRef Dashboard Types
// ============================================

export interface MerchantRefCouponSummary {
  total: number; // จำนวนคูปองทั้งหมดที่ผูกกับ merchantRef นี้ (ทั้งขายแล้วและยังไม่ขาย)
  sold: number; // จำนวนคูปองที่ขายให้ End User แล้ว (โอนกรรมสิทธิ์เป็น CUSTOMER แล้ว)
  unsold: number; // จำนวนคูปองที่ยังไม่ขาย (ยังอยู่ในความครอบครองของ Merchant/Seller)
}

export interface MerchantRefEndUserSummary {
  total: number; // จำนวน End User ทั้งหมด
  unredeemedUsers: number; // จำนวน End User ที่ซื้อแต่ยังไม่ใช้
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

// ============================================
// Coupon Dropdown Types
// ============================================

export interface CouponDropdownItem {
  id: string;
  name: string;
  merchantRef?: string | null;
  merchantRefName?: string | null;
}

export interface CouponDropdownResponse {
  coupons: CouponDropdownItem[];
}
