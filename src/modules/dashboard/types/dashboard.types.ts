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

  // ============================================
  // Section 1: ข้อมูลภาพรวมร้านของตนเอง
  // ============================================

  // 1.1 จำนวนคูปอง
  couponCount: {
    owned: number; // จำนวนคูปองที่เรามี
    purchased: number; // จำนวนคูปองที่ซื้อมา (= owned)
    sold: number; // จำนวนคูปองที่ขายทั้งหมด (เอาไปให้ End User ใช้)
    pending: number; // จำนวนคูปองที่ End User ซื้อแต่ยังไม่ใช้
    redeemed: number; // จำนวนคูปองที่ End User redeem แล้วจริง ๆ
  };

  // 1.2 มูลค่าคูปอง (THB)
  couponValueTHB: {
    owned: number; // มูลค่าคูปองที่เรามี (THB)
    sold: number; // มูลค่าคูปองที่ขายทั้งหมด (THB)
    pending: number; // มูลค่าคูปองที่ End User ซื้อแต่ยังไม่ใช้ (THB)
    redeemed: number; // มูลค่าคูปองที่ End User redeem แล้วจริง ๆ (THB)
  };

  // 1.3 มูลค่าคูปอง (Point)
  couponValuePoint: {
    sold: number; // มูลค่าคูปองที่ขายทั้งหมด (Point)
    pending: number; // มูลค่าคูปองที่ End User ซื้อแต่ยังไม่ใช้ (Point)
    redeemed: number; // มูลค่าคูปองที่ End User redeem แล้วจริง ๆ (Point)
  };

  // ============================================
  // Section 2: ข้อมูล End User
  // ============================================
  endUsers: {
    total: number; // จำนวน End User ทั้งหมด (ตั้งขายให้ End User ทั้งหมด)
    purchased: number; // จำนวน End User ที่ซื้อ (ตั้งขายให้ End User และ End User มาซื้อ)
    couponsSold: number; // จำนวนคูปองที่ขายทั้งหมด (เอาไปให้ End User ใช้)
    pending: number; // จำนวน End User ที่ซื้อแต่ยังไม่ใช้
    redeemed: number; // จำนวน End User ที่ redeem แล้วจริง ๆ
  };

  // ============================================
  // Section 3: Transaction
  // ============================================
  transactions: {
    total: number;
    transferPoint: { count: number; percentage: number }; // โอน Point
    redeemPoint: { count: number; percentage: number }; // Redeem Point
  };

  // ============================================
  // Section 4: Point
  // ============================================
  points: {
    byType: {
      // ประเภท Point ที่มี (Point อะไรบ้าง)
      type: string;
      initialSupply: number; // จำนวน Point เริ่มต้น
      remaining: number; // จำนวน Point คงเหลือ
    }[];
  };

  // ============================================
  // Section 5: THB Token
  // ============================================
  thbToken: {
    summary: {
      deposited: number; // THB Token ที่เติมเข้าไป
      spent: number; // THB Token ที่ใช้จองคูปองจาก Promotion Seller
    };
    monthly: (TimeSeriesData & {
      deposited: number;
      spent: number;
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
