# ระบบ Voucher แบบ 1 Voucher มี 1000 Unique Codes

## 📋 **โครงสร้าง**

```
Voucher (1 ใบ)
├─ VoucherCode 1: "VCHCR-A3F2B1C4"
├─ VoucherCode 2: "VCHCR-D8E5F9A2"
├─ VoucherCode 3: "VCHCR-B7C4A8E1"
├─ ... 
└─ VoucherCode 1000: "VCHCR-F9A2E3B8"
```

## 🚀 **การใช้งาน**

### **1. สร้าง Voucher พร้อม 1000 Codes**

```typescript
POST /voucher
{
  "id": "VCH-CENTRAL-20",
  "name": "ส่วนลด 20% เซ็นทรัล",
  "description": "รับส่วนลด 20% เมื่อใช้จ่ายครบ 2,000 บาท",
  "status": "active",
  "merchantName": "เซ็นทรัล รีเทล",
  "merchantId": "central-retail",
  "valueType": "percentage",
  "value": 20,
  "pointsCost": 100,
  "startDate": "2024-09-01",
  "endDate": "2025-12-31",
  "totalIssued": 1000,  // ← สร้าง 1000 codes
  "totalRedeemed": 0,
}
```

**ระบบจะ:**
- สร้าง 1 voucher
- สร้าง 1000 unique codes อัตโนมัติ
- เก็บใน `VoucherCode` table

---

### **2. ลูกค้าซื้อ/แลก Voucher → ได้ Code**

```typescript
POST /voucher/purchase
{
  "customerId": "customer-A",
  "voucherId": "VCH-CENTRAL-20"
}

// Response
{
  "success": true,
  "code": "VCHCR-A3F2B1C4",  // ← Code เฉพาะให้ลูกค้า A
  "voucher": {
    "name": "ส่วนลด 20% เซ็นทรัล",
    "value": 20,
    "valueType": "percentage"
  }
}
```

---

### **3. ลูกค้าใช้ Code**

```typescript
POST /voucher/redeem
{
  "customerId": "customer-A",
  "code": "VCHCR-A3F2B1C4"
}

// Response
{
  "success": true,
  "message": "Voucher redeemed successfully"
}
```

**ระบบจะ:**
- ตรวจสอบ code ว่ามีและยังไม่ใช้
- Mark `isUsed = true`
- บันทึก `usedBy` และ `usedAt`

---

## 💻 **Code Examples**

### **สร้าง Voucher พร้อม Codes**

```typescript
import { CreateVoucherWithCodes } from './handlers/createVoucherWithCodes.handler';

// สร้าง voucher พร้อม 1000 codes
const result = await createVoucherWithCodes.execute({
  id: 'VCH-CENTRAL-20',
  name: 'ส่วนลด 20% เซ็นทรัล',
  totalIssued: 1000,  // ← จำนวน codes
  // ... fields อื่นๆ
});

// Result: voucher + 1000 unique codes ใน database
```

### **ดึง Codes ที่ยังไม่ใช้**

```typescript
// ดึง 10 codes แรกที่ยังไม่ใช้
const availableCodes = await createVoucherWithCodes.getAvailableCodes(
  'VCH-CENTRAL-20',
  10
);

// [
//   { code: 'VCHCR-A3F2B1C4' },
//   { code: 'VCHCR-D8E5F9A2' },
//   ...
// ]
```

### **Export Codes ทั้งหมด**

```typescript
const allCodes = await createVoucherWithCodes.exportAllCodes('VCH-CENTRAL-20');

// [
//   { code: 'VCHCR-A3F2B1C4', isUsed: true, usedBy: 'customer-A', usedAt: '2025-11-11T...' },
//   { code: 'VCHCR-D8E5F9A2', isUsed: false, usedBy: null, usedAt: null },
//   ...
// ]
```

---

## 🎯 **ประเภท Code Generation**

### **1. Unique Random (แนะนำ)**
```typescript
generateUniqueCodes('VCH-CR-20', 1000)
// → ['VCHCR-A3F2B1C4', 'VCHCR-D8E5F9A2', ...]
```

### **2. Sequential**
```typescript
generateSequentialCodes('VCH-CR-20', 1000)
// → ['VCHCR-L9K2P-0001', 'VCHCR-L9K2P-0002', ...]
```

### **3. Short Codes**
```typescript
generateShortCodes('VCH-CR-20', 1000)
// → ['VCHA3F2B1', 'VCHD8E5F9', ...]
```

---

## 📊 **Query ที่มีประโยชน์**

### **เช็คจำนวน Codes ที่เหลือ**

```sql
SELECT COUNT(*) FROM "VoucherCode" 
WHERE "voucherId" = 'VCH-CENTRAL-20' 
AND "isUsed" = false;
```

### **ดู Codes ที่ถูกใช้แล้ว**

```sql
SELECT * FROM "VoucherCode" 
WHERE "voucherId" = 'VCH-CENTRAL-20' 
AND "isUsed" = true;
```

---

## ✅ **ข้อดี**

- ✅ แต่ละ code ไม่ซ้ำกัน 100%
- ✅ ควบคุมการแจกจ่ายได้
- ✅ Track ว่าใครใช้ code ไหน
- ✅ ป้องกันการ share code
- ✅ Export codes ได้

---

## 🔒 **ความปลอดภัย**

- Code ถูกสร้างด้วย `crypto.randomBytes()` → ปลอดภัย
- แต่ละ code unique → ไม่ซ้ำ
- Mark `isUsed` หลังใช้ → ใช้ได้ครั้งเดียว
- Track `usedBy` → รู้ว่าใครใช้
