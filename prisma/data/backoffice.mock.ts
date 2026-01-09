export type MerchantSeed = {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  points: number;
  location: string;
  website: string;
  voucherIds: string[];
  tel: string;
};

export type VoucherSeed = {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'upcoming';
  merchantName: string;
  merchantId?: string;
  imageUrl?: string;
  valueType: 'percentage' | 'cash' | 'gift' | 'multiplier';
  value: number;
  currency?: string;
  pointsCost: number;
  startDate: string;
  endDate: string;
  totalIssued: number;
  totalRedeemed: number;
  limitPerMember?: number;
};

export type PointSeed = {
  id: string;
  name: string;
  symbol: string;
  contractAddress: string;
  merchantId: string;
  frameSize: number;
  slotSize: number;
  initialSupply: number;
  decimal: number;
  imageUrl?: string;
};

export type ApiKeySeed = {
  id: string;
  name?: string;
  description?: string;
  apiKey: string;
  merchantId: string;
};

export type CustomerPointLink = {
  pointId: string;
  balances: number;
};

export type CustomerSeed = {
  id: string;
  email: string;
  walletAddress: string;
  firstName?: string;
  lastName?: string;
  merchantId: string;
  customerPoints: CustomerPointLink[];
  tel: string;
};

export type TransactionSeed = {
  id: string;
  txHash: string;
  senderAddress: string;
  receiverAddress: string;
  amount: number;
  transactionTypeId: 'MINT' | 'BURN' | 'TRANSFER' | 'EARN' | 'REDEEM' | 'THB_MINT' | 'THB_BUY';
  merchantId: string;
  pointId?: string;
  senderCustomerId?: string;
  receiverCustomerId?: string;
  createdAt: string;
};

export type UserSeed = {
  id: string;
  email: string;
  password: string;
  merchantIds: string[];
};

export const merchantSeeds: MerchantSeed[] = [
  {
    id: 'central-retail',
    name: 'เซ็นทรัล รีเทล',
    description: 'ห้างสรรพสินค้า เซ็นทรัล, โรบินสัน และท็อปส์',
    imageUrl:
      'https://images.unsplash.com/photo-1534452203293-494d7ddbf7e0?q=80&w=2952&auto=format&fit=crop',
    points: 50000,
    location: 'สาขาทั่วประเทศ',
    website: 'https://www.centralretail.com',
    voucherIds: ['VCH-CR-20', 'VCH-CR-BONUS'],
    tel: '02-123-4567',
  },
  {
    id: 'the-mall-group',
    name: 'เดอะมอลล์ กรุ๊ป',
    description: 'เดอะมอลล์, เอ็มโพเรียม และเอ็มควอเทียร์',
    imageUrl:
      'https://images.unsplash.com/photo-1519642918688-7e43b19245d8?q=80&w=2976&auto=format&fit=crop',
    points: 45000,
    location: 'กรุงเทพฯ และปริมณฑล',
    website: 'https://www.themallgroup.com',
    voucherIds: ['VCH-MALL-350', 'VCH-MALL-DINE'],
    tel: '02-234-5678',
  },
  {
    id: 'siam-piwat',
    name: 'สยามพิวรรธน์',
    description: 'สยามพารากอน, สยามเซ็นเตอร์ และไอคอนสยาม',
    imageUrl:
      'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?q=80&w=2940&auto=format&fit=crop',
    points: 40000,
    location: 'เขตปทุมวัน, คลองสาน',
    website: 'https://www.siampiwat.com',
    voucherIds: ['VCH-SP-15', 'VCH-SP-VIP'],
    tel: '02-245-6789',
  },
  {
    id: 'cp-all',
    name: 'ซีพี ออลล์',
    description: '7-Eleven และ CP Freshmart',
    imageUrl:
      'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?q=80&w=2940&auto=format&fit=crop',
    points: 30000,
    location: 'ร้านสะดวกซื้อทั่วประเทศ',
    website: 'https://www.cpall.co.th',
    voucherIds: ['VCH-CP-DRINK', 'VCH-CP-POINTX2'],
    tel: '02-256-7890',
  },
  {
    id: 'big-c',
    name: 'บิ๊กซี',
    description: 'ไฮเปอร์มาร์เก็ต และซูเปอร์เซ็นเตอร์',
    imageUrl:
      'https://images.unsplash.com/photo-1515706886582-54c73c5eaf41?q=80&w=2940&auto=format&fit=crop',
    points: 35000,
    location: 'สาขาทั่วประเทศ',
    website: 'https://www.bigc.co.th',
    voucherIds: ['VCH-BIGC-500', 'VCH-BIGC-FRESH'],
    tel: '02-267-8901',
  },
  {
    id: 'crg',
    name: 'เซ็นทรัล เรสเตอรองส์ กรุ๊ป',
    description: 'มิสเตอร์โดนัท, เคเอฟซี, อานตี้ แอนส์',
    imageUrl:
      'https://images.unsplash.com/photo-1552566626-52f8b828add9?q=80&w=2940&auto=format&fit=crop',
    points: 25000,
    location: 'ร้านอาหารทั่วประเทศ',
    website: 'https://www.crg.co.th',
    voucherIds: ['VCH-CRG-SET', 'VCH-CRG-POINTX3'],
    tel: '02-278-9012',
  },
];

export const userSeeds: UserSeed[] = [
  {
    id: 'user-central-admin',
    email: 'central.admin@demo.com',
    password: 'Password123!',
    merchantIds: ['central-retail'],
  },
  {
    id: 'user-mall-admin',
    email: 'mall.admin@demo.com',
    password: 'Password123!',
    merchantIds: ['the-mall-group'],
  },
  {
    id: 'user-siam-admin',
    email: 'siam.admin@demo.com',
    password: 'Password123!',
    merchantIds: ['siam-piwat'],
  },
  {
    id: 'user-cp-admin',
    email: 'cp.admin@demo.com',
    password: 'Password123!',
    merchantIds: ['cp-all'],
  },
  {
    id: 'user-bigc-admin',
    email: 'bigc.admin@demo.com',
    password: 'Password123!',
    merchantIds: ['big-c'],
  },
  {
    id: 'user-crg-admin',
    email: 'crg.admin@demo.com',
    password: 'Password123!',
    merchantIds: ['crg'],
  },
];

const baseVoucherSeeds: VoucherSeed[] = [
  {
    id: 'VCH-CR-20',
    name: 'ส่วนลด 20% เซ็นทรัล รีเทล',
    description:
      'รับส่วนลด 20% เมื่อใช้จ่ายครบ 2,000 บาท ที่เซ็นทรัล, โรบินสัน หรือท็อปส์',
    status: 'active',
    merchantName: 'เซ็นทรัล รีเทล',
    merchantId: 'central-retail',
    imageUrl:
      'https://images.unsplash.com/photo-1534452203293-494d7ddbf7e0?q=80&w=1600&auto=format&fit=crop',
    valueType: 'percentage',
    value: 20,
    pointsCost: 1200,
    startDate: '2024-09-01',
    endDate: '2025-12-31',
    totalIssued: 500,
    totalRedeemed: 235,
  },
  {
    id: 'VCH-CR-BONUS',
    name: 'บัตรของขวัญ ฿500 เซ็นทรัล',
    description: 'แลกรับบัตรของขวัญมูลค่า 500 บาท ใช้ได้ทุกสาขาในเครือเซ็นทรัล',
    status: 'upcoming',
    merchantName: 'เซ็นทรัล รีเทล',
    merchantId: 'central-retail',
    imageUrl:
      'https://images.unsplash.com/photo-1517677129300-07b130802f46?q=80&w=1600&auto=format&fit=crop',
    valueType: 'cash',
    value: 500,
    currency: '฿',
    pointsCost: 2600,
    startDate: '2025-01-05',
    endDate: '2026-03-31',
    totalIssued: 350,
    totalRedeemed: 0,
  },
  {
    id: 'VCH-MALL-350',
    name: 'คูปองเงินสด ฿350 เดอะมอลล์',
    description:
      'แลกรับคูปองเงินสด 350 บาท ใช้ได้กับห้างในเครือเดอะมอลล์กรุ๊ปทุกสาขา',
    status: 'active',
    merchantName: 'เดอะมอลล์ กรุ๊ป',
    merchantId: 'the-mall-group',
    imageUrl:
      'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?q=80&w=1600&auto=format&fit=crop',
    valueType: 'cash',
    value: 350,
    currency: '฿',
    pointsCost: 2200,
    startDate: '2024-10-01',
    endDate: '2026-01-15',
    totalIssued: 400,
    totalRedeemed: 150,
  },
  {
    id: 'VCH-MALL-DINE',
    name: 'เครดิตร้านอาหาร ฿300',
    description:
      'รับเครดิตสำหรับใช้ที่ Food Hall และร้านอาหารในเครือเดอะมอลล์กรุ๊ป',
    status: 'upcoming',
    merchantName: 'เดอะมอลล์ กรุ๊ป',
    merchantId: 'the-mall-group',
    imageUrl:
      'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?q=80&w=1600&auto=format&fit=crop',
    valueType: 'cash',
    value: 300,
    currency: '฿',
    pointsCost: 1600,
    startDate: '2024-12-15',
    endDate: '2026-06-30',
    totalIssued: 280,
    totalRedeemed: 0,
  },
  {
    id: 'VCH-CP-DRINK',
    name: 'ฟรีเครื่องดื่ม 1 แก้ว Café Amazon',
    description:
      'แลกฟรีเครื่องดื่มเมนูใดก็ได้ ขนาด 16 ออนซ์ ที่ Café Amazon ทุกสาขา',
    status: 'active',
    merchantName: 'ซีพี ออลล์',
    merchantId: 'cp-all',
    imageUrl:
      'https://images.unsplash.com/photo-1511920170033-f8396924c348?q=80&w=1600&auto=format&fit=crop',
    valueType: 'gift',
    value: 95,
    currency: '฿',
    pointsCost: 450,
    startDate: '2024-08-15',
    endDate: '2025-11-30',
    totalIssued: 800,
    totalRedeemed: 620,
  },
  {
    id: 'VCH-CP-POINTX2',
    name: 'คูณ 2 คะแนนซื้อของใน 7-Eleven',
    description:
      'รับคะแนนสะสมเพิ่ม 2 เท่าเมื่อซื้อสินค้าครบ 150 บาทขึ้นไปที่ 7-Eleven',
    status: 'upcoming',
    merchantName: 'ซีพี ออลล์',
    merchantId: 'cp-all',
    imageUrl:
      'https://images.unsplash.com/photo-1515008736322-38f085873a1a?q=80&w=1600&auto=format&fit=crop',
    valueType: 'multiplier',
    value: 2,
    pointsCost: 700,
    startDate: '2025-02-01',
    endDate: '2025-12-31',
    totalIssued: 1200,
    totalRedeemed: 0,
  },
  {
    id: 'VCH-SP-15',
    name: 'ส่วนลด 15% สยามพิวรรธน์',
    description:
      'รับส่วนลด 15% สำหรับสินค้าแฟชั่นและไลฟ์สไตล์ ที่สยามพารากอนและไอคอนสยาม',
    status: 'upcoming',
    merchantName: 'สยามพิวรรธน์',
    merchantId: 'siam-piwat',
    imageUrl:
      'https://images.unsplash.com/photo-1522228115018-d838bcce5c3a?q=80&w=1600&auto=format&fit=crop',
    valueType: 'percentage',
    value: 15,
    pointsCost: 1800,
    startDate: '2024-11-10',
    endDate: '2026-02-28',
    totalIssued: 300,
    totalRedeemed: 0,
  },
  {
    id: 'VCH-SP-VIP',
    name: 'บัตร Lounge Access ICONSIAM',
    description:
      'สิทธิ์เข้าร่วมคลับเลาจน์ ICONSIAM พร้อมเครื่องดื่มต้อนรับสำหรับ 2 ท่าน',
    status: 'active',
    merchantName: 'สยามพิวรรธน์',
    merchantId: 'siam-piwat',
    imageUrl:
      'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?q=80&w=1600&auto=format&fit=crop',
    valueType: 'gift',
    value: 1,
    pointsCost: 4800,
    startDate: '2024-07-01',
    endDate: '2025-07-31',
    totalIssued: 180,
    totalRedeemed: 90,
  },
  {
    id: 'VCH-BIGC-500',
    name: 'ส่วนลด ฿500 บิ๊กซี',
    description:
      'ใช้เป็นส่วนลด 500 บาท เมื่อซื้อสินค้าครบ 3,000 บาทที่บิ๊กซีทุกสาขา',
    status: 'active',
    merchantName: 'บิ๊กซี',
    merchantId: 'big-c',
    imageUrl:
      'https://images.unsplash.com/photo-1515706886582-54c73c5eaf41?q=80&w=1600&auto=format&fit=crop',
    valueType: 'cash',
    value: 500,
    currency: '฿',
    pointsCost: 1500,
    startDate: '2024-05-01',
    endDate: '2025-08-31',
    totalIssued: 700,
    totalRedeemed: 540,
  },
  {
    id: 'VCH-BIGC-FRESH',
    name: 'ส่วนลด 12% สินค้า Fresh Food',
    description:
      'ส่วนลด 12% สำหรับสินค้ากลุ่มอาหารสดและของใช้ในครัวเรือนที่บิ๊กซี',
    status: 'upcoming',
    merchantName: 'บิ๊กซี',
    merchantId: 'big-c',
    imageUrl:
      'https://images.unsplash.com/photo-1504753793650-d4a2b783c15e?q=80&w=1600&auto=format&fit=crop',
    valueType: 'percentage',
    value: 12,
    pointsCost: 900,
    startDate: '2025-01-10',
    endDate: '2025-12-31',
    totalIssued: 650,
    totalRedeemed: 0,
  },
  {
    id: 'VCH-CRG-SET',
    name: 'เซ็ตมื้อใหญ่ CRG',
    description:
      'ชุดคอมโบสำหรับ 2 ท่าน ใช้ได้ที่ร้านอาหารในเครือ CRG (KFC, Mister Donut, Ootoya)',
    status: 'active',
    merchantName: 'เซ็นทรัล เรสเตอรองส์ กรุ๊ป',
    merchantId: 'crg',
    imageUrl:
      'https://images.unsplash.com/photo-1552566626-52f8b828add9?q=80&w=1600&auto=format&fit=crop',
    valueType: 'gift',
    value: 499,
    currency: '฿',
    pointsCost: 1800,
    startDate: '2024-06-01',
    endDate: '2025-06-30',
    totalIssued: 550,
    totalRedeemed: 310,
  },
  {
    id: 'VCH-CRG-POINTX3',
    name: 'คูณ 3 คะแนนร้านอาหารเครือ CRG',
    description:
      'รับคะแนนสะสมเพิ่ม 3 เท่า เมื่อรับประทานอาหารครบ 500 บาทขึ้นไปในเครือ CRG',
    status: 'upcoming',
    merchantName: 'เซ็นทรัล เรสเตอรองส์ กรุ๊ป',
    merchantId: 'crg',
    imageUrl:
      'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=1600&auto=format&fit=crop',
    valueType: 'multiplier',
    value: 3,
    pointsCost: 950,
    startDate: '2025-03-01',
    endDate: '2025-12-31',
    totalIssued: 900,
    totalRedeemed: 0,
  },
];

const couponMerchantMapping: Record<string, string> = {
  'Central Retail': 'central-retail',
  'The Mall Group': 'the-mall-group',
  'CP All': 'cp-all',
  'Siam Piwat': 'siam-piwat',
  'Central Restaurants Group': 'crg',
};

const couponDerivedVoucherSeeds: VoucherSeed[] = [
  {
    id: 'CPN-CR-120',
    name: 'ส่วนลด 20% ที่เซ็นทรัล รีเทล',
    description:
      'รับส่วนลด 20% เมื่อใช้จ่ายครบ 2,000 บาท ที่เซ็นทรัล, โรบินสัน หรือท็อปส์',
    status: 'active',
    merchantName: 'Central Retail',
    merchantId: couponMerchantMapping['Central Retail'],
    valueType: 'percentage',
    value: 20,
    pointsCost: 1200,
    startDate: '2024-09-01',
    endDate: '2025-12-31',
    totalIssued: 500,
    totalRedeemed: 235,
    limitPerMember: 2,
  },
  {
    id: 'CPN-MM-350',
    name: 'คูปองเงินสด ฿350 เดอะมอลล์กรุ๊ป',
    description:
      'แลกรับคูปองเงินสดมูลค่า 350 บาท ใช้ได้กับทุกห้างในเครือเดอะมอลล์กรุ๊ป',
    status: 'active',
    merchantName: 'The Mall Group',
    merchantId: couponMerchantMapping['The Mall Group'],
    valueType: 'cash',
    value: 350,
    currency: '฿',
    pointsCost: 2200,
    startDate: '2024-10-01',
    endDate: '2026-01-15',
    totalIssued: 400,
    totalRedeemed: 150,
    limitPerMember: 3,
  },
  {
    id: 'CPN-CP-075',
    name: 'ฟรีเครื่องดื่ม 1 แก้ว ที่ Café Amazon',
    description:
      'แลกรับเครื่องดื่มเมนูใดก็ได้ ขนาด 16 ออนซ์ ที่ Café Amazon ทุกสาขา',
    status: 'active',
    merchantName: 'CP All',
    merchantId: couponMerchantMapping['CP All'],
    valueType: 'gift',
    value: 95,
    currency: '฿',
    pointsCost: 450,
    startDate: '2024-08-15',
    endDate: '2025-11-30',
    totalIssued: 800,
    totalRedeemed: 620,
    limitPerMember: 5,
  },
  {
    id: 'CPN-SP-150',
    name: 'ส่วนลด 15% สยามพิวรรธน์',
    description:
      'รับส่วนลด 15% สำหรับสินค้าแฟชั่นและไลฟ์สไตล์ ที่สยามพารากอนและไอคอนสยาม',
    status: 'upcoming',
    merchantName: 'Siam Piwat',
    merchantId: couponMerchantMapping['Siam Piwat'],
    valueType: 'percentage',
    value: 15,
    pointsCost: 1800,
    startDate: '2024-11-10',
    endDate: '2026-02-28',
    totalIssued: 300,
    totalRedeemed: 0,
    limitPerMember: 1,
  },
  {
    id: 'CPN-CRG-2X',
    name: 'คูณ 2 คะแนนร้านอาหารในเครือ CRG',
    description:
      'รับคะแนนสะสมเพิ่ม 2 เท่า เมื่อรับประทานอาหารที่ร้านอาหารในเครือ CRG',
    status: 'upcoming',
    merchantName: 'Central Restaurants Group',
    merchantId: couponMerchantMapping['Central Restaurants Group'],
    valueType: 'multiplier',
    value: 2,
    pointsCost: 800,
    startDate: '2024-12-01',
    endDate: '2026-03-31',
    totalIssued: 600,
    totalRedeemed: 0,
  },
];

export const voucherSeeds: VoucherSeed[] = [
  ...baseVoucherSeeds,
  ...couponDerivedVoucherSeeds,
];

export const pointSeeds: PointSeed[] = [
  // {
  //   id: 'point-demo-1',
  //   name: 'Central Reward Points',
  //   symbol: 'CRP',
  //   contractAddress: '0xc000000000000000000000000000000000000001',
  //   merchantId: 'central-retail',
  //   frameSize: 1000,
  //   slotSize: 100,
  //   initialSupply: 1_000_000,
  //   decimal: 18,
  // },
  // {
  //   id: 'point-demo-2',
  //   name: 'The Mall Privilege',
  //   symbol: 'TMP',
  //   contractAddress: '0xc000000000000000000000000000000000000002',
  //   merchantId: 'the-mall-group',
  //   frameSize: 800,
  //   slotSize: 80,
  //   initialSupply: 750_000,
  //   decimal: 18,
  // },
];

export const apiKeySeeds: ApiKeySeed[] = [
  {
    id: 'apikey-demo-1',
    name: 'Public API',
    description: 'ใช้ผูกระบบสมาชิก',
    apiKey: 'pk_demo_public_123456',
    merchantId: 'central-retail',
  },
  {
    id: 'apikey-demo-2',
    name: 'Internal API',
    description: 'เชื่อมต่อระบบ CRM',
    apiKey: 'pk_demo_internal_654321',
    merchantId: 'the-mall-group',
  },
];

export const customerSeeds: CustomerSeed[] = [
  {
    id: 'customer-demo-1',
    email: 'alice@central.co.th',
    walletAddress: '0x1111222233334444555566667777888899990000',
    firstName: 'Alice',
    lastName: 'Wong',
    merchantId: 'central-retail',
    customerPoints: [
      // {
      //   pointId: 'point-demo-1',
      //   balances: 1250,
      // },
    ],
    tel: '081-111-1111',
  },
  {
    id: 'customer-demo-2',
    email: 'bob@themall.co.th',
    walletAddress: '0xaaaabbbbccccddddeeeeffff0000111122223333',
    firstName: 'Bob',
    lastName: 'Supasith',
    merchantId: 'the-mall-group',
    customerPoints: [
      // {
      //   pointId: 'point-demo-2',
      //   balances: 320,
      // },
    ],
    tel: '082-222-2222',
  },
];

export const transactionSeeds: TransactionSeed[] = [
  {
    id: 'tx-demo-1',
    txHash:
      '0x1111111111111111111111111111111111111111111111111111111111111111',
    senderAddress: '0xcccccccccccccccccccccccccccccccccccccccc',
    receiverAddress: '0x1111222233334444555566667777888899990000',
    amount: 450,
    transactionTypeId: 'REDEEM',
    merchantId: 'central-retail',
    // pointId: 'point-demo-1',
    receiverCustomerId: 'customer-demo-1',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'tx-demo-2',
    txHash:
      '0x2222222222222222222222222222222222222222222222222222222222222222',
    senderAddress: '0xaaaabbbbccccddddeeeeffff0000111122223333',
    receiverAddress: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    amount: 200,
    transactionTypeId: 'EARN',
    merchantId: 'the-mall-group',
    // pointId: 'point-demo-2',
    senderCustomerId: 'customer-demo-2',
    createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
  },
];
