// Shared Dashboard Types

export interface DateRangeInfo {
  startDate: string;
  endDate: string;
  granularity: 'daily' | 'weekly' | 'monthly';
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

  // Section 1: Voucher Overview (Donut Chart)
  vouchers: {
    total: number; // รวม
    sold: number; // ขายที่สนใจ
    pending: number; // รอใช้งาน
    redeemed: number; // Redeem แล้ว
  };

  // Section 2: Voucher Value (Horizontal Bar Chart)
  voucherValue: {
    total: number; // มูลค่าคูปองที่มีทั้งหมด (THB)
    sold: number; // มูลค่าที่ขายได้
    redeemed: number; // มูลค่าที่ Redeem แล้ว
    currency: 'THB';
  };

  // Section 3 & 4: End User Stats + Growth
  endUsers: {
    total: number; // จำนวนที่สร้าง
    purchased: number; // คนซื้อ
    couponsPurchased: number; // คูปองซื้อ
    pending: number; // จ่ายใบ
    redeemed: number; // Redeem แล้ว
    growth: (TimeSeriesData & {
      newUsers: number;
      activeUsers: number;
    })[];
  };

  // Section 5: Transaction (Pie Chart)
  transactions: {
    total: number;
    buyPoint: { count: number; percentage: number };
    redeemPoint: { count: number; percentage: number };
  };

  // Section 6: Point (Donut Chart)
  points: {
    totalCirculation: number;
    byType: {
      type: string; // "Loyalty Point", "Bonus Point", "Referral Point"
      value: number;
    }[];
  };

  // Section 7: THB Token (Bar Chart)
  thbToken: {
    summary: {
      deposited: number;
      spent: number;
      usedForRedeem: number;
    };
    monthly: (TimeSeriesData & {
      deposited: number;
      spent: number;
      usedForRedeem: number;
    })[];
  };
}

// ============================================
// Seller Dashboard Types
// ============================================

export interface SellerDashboardResponse {
  dateRange: DateRangeInfo;
  walletAddress: string;

  overview: {
    // จำนวนคูปอง
    coupons: {
      listed: number; // คูปองที่ลงขายทั้งหมด
      soldToMarketer: number; // Marketer ซื้อไปแล้ว
      available: number; // ยังไม่ขาย
    };
    // มูลค่าคูปอง
    value: {
      listed: number; // มูลค่าที่ลงขาย (THB)
      soldToMarketer: number; // มูลค่าที่ขายได้
      available: number; // มูลค่าคงเหลือ
      currency: 'THB';
    };
  };

  // แยกตาม Merchant ที่ซื้อไป
  byMarketer: {
    merchantId: string;
    merchantName: string;
    couponsBought: number;
    valueBought: number;
  }[];

  timeSeries?: (TimeSeriesData & {
    listed: number;
    sold: number;
  })[];
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

  timeSeries?: (TimeSeriesData & {
    couponsSold: number;
    couponsRedeemed: number;
    newUsers: number;
  })[];
}
