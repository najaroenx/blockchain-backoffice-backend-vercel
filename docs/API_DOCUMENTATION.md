# API Documentation

**Service API Base URL:** `https://dlp-backofficebe-testnet.adldigitalservice.com`

---

## 1. Get Customer Wallet by Phone

**Description:** ค้นหาข้อมูล Wallet และ Voucher ของลูกค้าด้วยเบอร์โทรศัพท์

### Request

**Method:** `GET`

**URL:** `{{endpoint_url}}/:merchantId/customer/phone/:phone?callbackUri=`

**Example:** `https://dlp-backofficebe-testnet.adldigitalservice.com/cmih1s6qu00050i01m3cactjj/customer/phone/0987665432?callbackUri=https://example.com`

### Request Parameters

#### Header Fields

| Parameter | Type | M/O | Description | Example |
|-----------|------|-----|-------------|---------|
| x-api-key | String | M | API Key สำหรับ authentication | LEk8YLySHJdMD_nD0cw5 |

#### Path Parameters

| Parameter | Type | M/O | Description | Example |
|-----------|------|-----|-------------|---------|
| merchantId | String | M | รหัสร้านค้า | cmi5o77hc00079yqzgrtf0e5l |
| phone | String | M | เบอร์โทรศัพท์ของลูกค้า | 0987665432 |

#### Query Parameters

| Parameter | Type | M/O | Description | Example |
|-----------|------|-----|-------------|---------|
| callbackUri | String | O | URL สำหรับ redirect กลับ (ใช้กรณีไม่เจอ user) | https://example.com |

### Response

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| message | String | ข้อความสถานะ |
| statusCode | Number | HTTP status code |
| data | Object | ข้อมูลลูกค้า |
| data.id | String | รหัสลูกค้า |
| data.email | String | อีเมลลูกค้า |
| data.firstName | String \| null | ชื่อจริง |
| data.lastName | String \| null | นามสกุล |
| data.phone | String | เบอร์โทรศัพท์ |
| data.walletAddress | String | Wallet address |
| data.wallet | Object | ข้อมูล wallet |
| data.wallet.walletAddress | String | Wallet address |
| data.wallet.privateKey | String | Private key (encrypted) |
| data.wallet.type | String | ประเภท wallet (customer) |
| data.wallet.status | String | สถานะ wallet (active/inactive) |
| data.customerMerChant | Array | รายการร้านค้าที่ลูกค้าลงทะเบียน |
| data.customerPoints | Array | รายการคะแนนของลูกค้า |
| data.customerPoints[].balances | Number | ยอดคะแนนคงเหลือ |
| data.customerPoints[].pointId | String | รหัสคะแนน |
| data.customerPoints[].point | Object | ข้อมูลคะแนน |
| data.ownedVouchers | Array | รายการ voucher ที่ลูกค้าเป็นเจ้าของ (grouped by voucherGroupId และ codeStatus) |
| data.ownedVouchers[].voucherGroupId | String | รหัสกลุ่ม voucher (ใช้จัดกลุ่ม voucher ที่เหมือนกัน) |
| data.ownedVouchers[].voucher | Object | ข้อมูล voucher รวม merchantRef |
| data.ownedVouchers[].latestCode | String | รหัส voucher code ล่าสุดในกลุ่มนี้ |
| data.ownedVouchers[].codeStatus | String | สถานะของ code ในกลุ่ม: `unused` (ยังไม่ได้ใช้), `used` (ใช้แล้ว), `expired` (หมดอายุ) |
| data.ownedVouchers[].totalCodes | Number | จำนวน code ทั้งหมดในกลุ่มนี้ที่มีสถานะเดียวกัน |
| data.ownedVouchers[].pointsCost | Number | จำนวนคะแนนที่ใช้ซื้อ |
| data.ownedVouchers[].currency | String | สกุลเงินหรือคะแนนที่ใช้ซื้อ |

#### Success Response (200)

```json
{
  "message": "Customer found successfully",
  "statusCode": 200,
  "data": {
    "id": "cmiisvgqn0007xk01efv8szbq",
    "email": "userklla5@example.com",
    "firstName": null,
    "lastName": null,
    "wallet": {
      "id": "cmiisvgq90005xk01r6tm70vi",
      "walletAddress": "0x50581102bEB5cDEb68cB5f84ACdE46fa2DeB842E",
      "privateKey": "U2FsdGVkX1/t6cRgrqjhq0b7nkUE+38qfsGqnQNkkbT0VOdUh5YZcF3DxuDkMi7j3npJqkAd7NhkNAVsnjAkablReIRauDtE6DTt9DVRA+V8V4vkUK0sec3xEydIcJVx",
      "email": "userklla5@example.com",
      "phoneNumber": "0984360421",
      "type": "customer",
      "status": "active"
    },
    "customerMerChant": [
      {
        "id": "cmiisvgqn0009xk01hslgbrch",
        "merchantId": "cmih1s6qu00050i01m3cactjj",
        "customerId": "cmiisvgqn0007xk01efv8szbq"
      }
    ],
    "customerPoints": [
      {
        "balances": 10,
        "id": "cmiiswd73000cxk01hm55ijbw",
        "pointId": "cmiimp4g400015v01nv1ij7zf",
        "point": {
          "id": "cmiimp4g400015v01nv1ij7zf",
          "name": "LAT",
          "symbol": "LAT",
          "merchantId": "cmih1s6qu00050i01m3cactjj",
          "imageUrl": "https://images.unsplash.com/photo-1740175919702-cd5adce2d168?ixlib=rb-4.1.0&auto=format&fit=crop&w=986"
        }
      }
    ],
    "ownedVouchers": [
      {
        "voucherGroupId": "group-123",
        "voucher": {
          "id": "voucher-mock-1",
          "name": "Welcome Discount 20%",
          "description": "Get 20% off on your first purchase",
          "imageUrl": "https://via.placeholder.com/300x200?text=Welcome+Discount",
          "value": 20,
          "valueType": "percentage",
          "status": "active",
          "startDate": "2025-11-28T11:50:32.760Z",
          "endDate": "2025-12-28T11:50:32.760Z",
          "merchantRef": "merchant-ref-001"
        },
        "latestCode": "WELCOME2024",
        "codeStatus": "unused",
        "totalCodes": 3,
        "pointsCost": 100,
        "currency": "POINTS"
      },
      {
        "voucherGroupId": "group-123",
        "voucher": {
          "id": "voucher-mock-1",
          "name": "Welcome Discount 20%",
          "description": "Get 20% off on your first purchase",
          "imageUrl": "https://via.placeholder.com/300x200?text=Welcome+Discount",
          "value": 20,
          "valueType": "percentage",
          "status": "active",
          "startDate": "2025-11-28T11:50:32.760Z",
          "endDate": "2025-12-28T11:50:32.760Z",
          "merchantRef": "merchant-ref-001"
        },
        "latestCode": "WELCOME2023",
        "codeStatus": "used",
        "totalCodes": 2,
        "pointsCost": 100,
        "currency": "POINTS"
      },
      {
        "voucherGroupId": "group-456",
        "voucher": {
          "id": "voucher-mock-2",
          "name": "Free Shipping",
          "description": "Free shipping on orders over $50",
          "imageUrl": "https://via.placeholder.com/300x200?text=Free+Shipping",
          "value": 0,
          "valueType": "gift",
          "status": "active",
          "startDate": "2025-11-28T11:50:32.760Z",
          "endDate": "2026-01-27T11:50:32.760Z",
          "merchantRef": "merchant-ref-002"
        },
        "latestCode": "FREESHIP50",
        "codeStatus": "unused",
        "totalCodes": 1,
        "pointsCost": 50,
        "currency": "POINTS"
      }
    ],
    "phone": "0984360421",
    "walletAddress": "0x50581102bEB5cDEb68cB5f84ACdE46fa2DeB842E"
  }
}
```

**หมายเหตุเกี่ยวกับ ownedVouchers:**
- **การจัดกลุ่ม (Grouping):** Voucher codes จะถูกจัดกลุ่มตาม `voucherGroupId` (หรือ `voucherId` ถ้าไม่มี voucherGroupId) และแยกตาม `codeStatus`
- **codeStatus:** มี 3 สถานะ
  - `unused`: คูปองที่ยังไม่ได้ใช้งานและยังไม่หมดอายุ
  - `used`: คูปองที่ใช้งานไปแล้ว
  - `expired`: คูปองที่หมดอายุแล้ว (เช็คจาก `endDate < วันที่ปัจจุบัน`)
- **latestCode:** แสดงรหัสคูปองล่าสุดในแต่ละกลุ่ม (เรียงตาม `createdAt` จากล่าสุดไปเก่าสุด)
- **totalCodes:** จำนวนคูปองทั้งหมดในกลุ่มที่มีสถานะเดียวกัน
- **ตัวอย่าง:** หากลูกค้ามีคูปอง "Welcome Discount" จำนวน 5 ใบ โดยใช้ไปแล้ว 2 ใบ ยังไม่ใช้ 3 ใบ จะแสดงเป็น 2 กลุ่ม:
  - กลุ่มที่ 1: `voucherGroupId: "group-123"`, `codeStatus: "unused"`, `totalCodes: 3`, `latestCode: "WELCOME2024"`
  - กลุ่มที่ 2: `voucherGroupId: "group-123"`, `codeStatus: "used"`, `totalCodes: 2`, `latestCode: "WELCOME2023"`

#### Error Response (404 - User Not Found)

```json
{
  "statusCode": 404,
  "message": "Customer with phone 0984360421 not found",
  "data": {
    "url": "http://localhost:3000/otp?requestid=d3c73735-0d03-44b1-b618-cd44d78bb742&merchantId=cmiiq8h3j00059y6afhrmhora&callbackUri=https://www.google.com",
    "callbackUri": "https://www.google.com",
    "merchantId": "cmiiq8h3j00059y6afhrmhora"
  }
}
```

### Response Status Codes

| HTTP Status | Status Code | Description |
|-------------|-------------|-------------|
| 200 | 200 | Success - Customer found |
| 404 | 404 | Customer not found (returns OTP registration URL) |
| 401 | 401 | Unauthorized - Invalid API Key |
| 500 | 500 | Internal Server Error |

---

## 2. Send Point B2C

**Description:** ส่งคะแนนให้ลูกค้า (Business to Customer)

### Request

**Method:** `POST`

**URL:** `{{endpoint_url}}/:merchantId/transaction/:pointId`

**Example:** `https://dlp-backofficebe-testnet.adldigitalservice.com/cmih1s6qu00050i01m3cactjj/transaction/cmiimp4g400015v01nv1ij7zf`

### Request Parameters

#### Header Fields

| Parameter | Type | M/O | Description | Example |
|-----------|------|-----|-------------|---------|
| x-api-key | String | M | API Key สำหรับ authentication | LEk8YLySHJdMD_nD0cw5 |

#### Path Parameters

| Parameter | Type | M/O | Description | Example |
|-----------|------|-----|-------------|---------|
| merchantId | String | M | รหัสร้านค้า | cmih1s6qu00050i01m3cactjj |
| pointId | String | M | รหัสคะแนน | cmiimp4g400015v01nv1ij7zf |

#### Request Body

| Parameter | Type | M/O | Description | Example |
|-----------|------|-----|-------------|---------|
| amount | Number | M | จำนวนคะแนนที่ต้องการส่ง | 10 |
| phone | String | M | เบอร์โทรศัพท์ของผู้รับ | 0984360421 |
| transactionTypeId | String | O | ประเภทธุรกรรม (default: TRANSFER) | TRANSFER |
| eventId | String | O | รหัสอีเว้นท์สำหรับติดตามธุรกรรม | event_12345 |

**Example Request Body:**
```json
{
  "amount": 10,
  "phone": "0984360421",
  "transactionTypeId": "TRANSFER",
  "eventId": "event_12345"
}
```

### Response

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| id | String | รหัสธุรกรรม (Transaction ID) |
| txHash | String | Transaction hash บน blockchain |
| senderAddress | String | Wallet address ของผู้ส่ง (Merchant) |
| receiverAddress | String | Wallet address ของผู้รับ (Customer) |
| amount | Number | จำนวนคะแนนที่โอน |
| createdAt | String | วันที่สร้างธุรกรรม (ISO 8601) |
| updatedAt | String | วันที่อัพเดทธุรกรรมล่าสุด (ISO 8601) |
| merchantId | String | รหัสร้านค้า |
| pointId | String | รหัสคะแนน |
| transactionTypeId | String | ประเภทธุรกรรม (TRANSFER, MINT, BURN, etc.) |
| voucherCodeId | String \| null | รหัส voucher code (ถ้ามี) |
| eventId | String \| null | รหัสอีเว้นท์ (ถ้ามี) |
| senderId | String \| null | รหัสผู้ส่ง (null สำหรับ B2C) |
| receiverId | String | รหัสผู้รับ (Customer ID) |

#### Success Response (201)

```json
{
  "id": "cmiiswd23000axk01f35tq4td",
  "txHash": "0xc24bec9dc9eade84bd15d55386c79b0d858c3b18700be655d17e060eadaadfaf",
  "senderAddress": "0x5291e73df82e9b162ab09b64ba5c0b8d359ebc38",
  "receiverAddress": "0x50581102beb5cdeb68cb5f84acde46fa2deb842e",
  "amount": 10,
  "createdAt": "2025-11-28T11:50:22.491Z",
  "updatedAt": "2025-11-28T11:50:22.491Z",
  "merchantId": "cmih1s6qu00050i01m3cactjj",
  "pointId": "cmiimp4g400015v01nv1ij7zf",
  "transactionTypeId": "TRANSFER",
  "voucherCodeId": null,
  "eventId": null,
  "senderId": null,
  "receiverId": "cmiisvgqn0007xk01efv8szbq"
}
```

**Note:** This endpoint creates a single transaction record with both sender and receiver information. When customers query their transaction history, a `transactionDirection` field (`SENT` or `RECEIVED`) indicates whether they sent or received points in each transaction.

### Response Status Codes

| HTTP Status | Status Code | Description |
|-------------|-------------|-------------|
| 201 | 201 | Success - Transaction completed |
| 400 | 400 | Bad Request - Invalid parameters |
| 401 | 401 | Unauthorized - Invalid API Key |
| 404 | 404 | Not Found - Customer or Point not found |
| 500 | 500 | Internal Server Error |

---

## 3. Get Point Transactions by Customer Phone (Merchant-Scoped)

**Description:** ดึงประวัติ point transactions ของลูกค้าในร้านค้านั้นๆ ด้วยเบอร์โทรศัพท์ (ไม่รวม voucher ownership transactions)

### Request

**Method:** `GET`

**URL:** `{{endpoint_url}}/:merchantId/transaction/customer/phone/:phone/points`

**Example:** `https://dlp-backofficebe-testnet.adldigitalservice.com/cmih1s6qu00050i01m3cactjj/transaction/customer/phone/0984360421/points`

### Request Parameters

#### Header Fields

| Parameter | Type | M/O | Description | Example |
|-----------|------|-----|-------------|---------|
| x-api-key | String | M | API Key สำหรับ authentication | LEk8YLySHJdMD_nD0cw5 |

#### Path Parameters

| Parameter | Type | M/O | Description | Example |
|-----------|------|-----|-------------|---------|
| merchantId | String | M | รหัสร้านค้า | cmih1s6qu00050i01m3cactjj |
| phone | String | M | เบอร์โทรศัพท์ของลูกค้า (10 digits) | 0984360421 |

### Response

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| transactions | Array | รายการ point transactions (MINT, TRANSFER, BURN, EARN, MARKETPLACE_PURCHASE) |
| transactions[].id | String | รหัสธุรกรรม |
| transactions[].transactionHash | String | Transaction hash บน blockchain |
| transactions[].transactionTypeId | String | ประเภทธุรกรรม (MINT, TRANSFER, BURN, EARN, MARKETPLACE_PURCHASE) |
| transactions[].amount | Number | จำนวน point |
| transactions[].direction | String | ทิศทางจากมุมมองลูกค้า: `SENT` หรือ `RECEIVED` |
| transactions[].point | Object | ข้อมูล point |
| transactions[].point.id | String | รหัส point |
| transactions[].point.name | String | ชื่อ point |
| transactions[].point.symbol | String | สัญลักษณ์ point |
| transactions[].point.imageUrl | String \| null | URL รูปภาพ point logo |
| transactions[].voucher | Object \| null | ข้อมูล voucher (สำหรับ MARKETPLACE_PURCHASE) |
| transactions[].voucher.id | String | รหัส voucher |
| transactions[].voucher.name | String | ชื่อ voucher |
| transactions[].voucher.valueType | String | ประเภทมูลค่า (cash, percent, free) |
| transactions[].voucher.value | Number | มูลค่า voucher |
| transactions[].voucher.imageUrl | String | URL รูปภาพ voucher |
| transactions[].voucherCodeId | String \| null | รหัส voucher code (ถ้ามี) |
| transactions[].sender | Object | ข้อมูลผู้ส่ง |
| transactions[].sender.id | String | รหัสผู้ส่ง |
| transactions[].sender.walletAddress | String | Wallet address ผู้ส่ง |
| transactions[].sender.emailOrWebsite | String | อีเมลหรือเว็บไซต์ |
| transactions[].receiver | Object | ข้อมูลผู้รับ |
| transactions[].receiver.id | String | รหัสผู้รับ |
| transactions[].receiver.walletAddress | String | Wallet address ผู้รับ |
| transactions[].receiver.emailOrWebsite | String | อีเมลหรือเว็บไซต์ |
| transactions[].merchant | Object | ข้อมูลร้านค้า |
| transactions[].merchant.id | String | รหัสร้านค้า |
| transactions[].merchant.name | String | ชื่อร้านค้า |
| transactions[].createdAt | String | วันที่สร้างธุรกรรม (ISO 8601) |
| counts | Number | จำนวน point transactions ทั้งหมด |

#### Success Response (200)

```json
{
  "transactions": [
    {
      "id": "cm4p9kv7j003y7w5xhps7krvz",
      "transactionHash": "0xc24bec9dc9eade84bd15d55386c79b0d858c3b18700be655d17e060eadaadfaf",
      "transactionTypeId": "MARKETPLACE_PURCHASE",
      "amount": 100,
      "direction": "SENT",
      "point": {
        "id": "cm4ohkm5l000099b5ebs3eltd",
        "name": "AIS Points",
        "symbol": "AISP",
        "imageUrl": "https://example.com/images/ais-point.png"
      },
      "voucher": {
        "id": "cm4p9abc123xyz",
        "name": "Starbucks 100 THB",
        "valueType": "cash",
        "value": 100,
        "imageUrl": "https://example.com/images/starbucks.png"
      },
      "voucherCodeId": "cm4p9code123",
      "sender": {
        "id": "cmiisvgqn0007xk01efv8szbq",
        "walletAddress": "0x50581102beb5cdeb68cb5f84acde46fa2deb842e",
        "emailOrWebsite": "customer@example.com"
      },
      "receiver": {
        "id": "cmih1s6qu00050i01m3cactjj",
        "walletAddress": "0x5291e73df82e9b162ab09b64ba5c0b8d359ebc38",
        "emailOrWebsite": "https://merchant-website.com"
      },
      "merchant": {
        "id": "cmih1s6qu00050i01m3cactjj",
        "name": "AIS Shop"
      },
      "createdAt": "2025-12-11T10:30:00.000Z"
    },
    {
      "id": "cm4p9xyz789abc",
      "transactionHash": "0xabc123...",
      "transactionTypeId": "TRANSFER",
      "amount": 50,
      "direction": "RECEIVED",
      "point": {
        "id": "cm4ohkm5l000099b5ebs3eltd",
        "name": "AIS Points",
        "symbol": "AISP",
        "imageUrl": "https://example.com/images/ais-point.png"
      },
      "voucher": null,
      "voucherCodeId": null,
      "sender": {
        "id": "sender123",
        "walletAddress": "0x1234...",
        "emailOrWebsite": "sender@example.com"
      },
      "receiver": {
        "id": "cmiisvgqn0007xk01efv8szbq",
        "walletAddress": "0x50581102beb5cdeb68cb5f84acde46fa2deb842e",
        "emailOrWebsite": "customer@example.com"
      },
      "merchant": {
        "id": "cmih1s6qu00050i01m3cactjj",
        "name": "AIS Shop"
      },
      "createdAt": "2025-12-10T15:20:00.000Z"
    }
  ],
  "counts": 2
}
```

### Response Status Codes

| HTTP Status | Status Code | Description |
|-------------|-------------|-------------|
| 200 | 200 | Success - Point transactions retrieved |
| 404 | 404 | Not Found - Customer not found |
| 500 | 500 | Internal Server Error |

### Notes

- **Transaction Types Included:** MINT, TRANSFER, BURN, EARN, MARKETPLACE_PURCHASE
- **MARKETPLACE_PURCHASE:** แสดง point deduction พร้อม voucher details ใน `voucher` object
- **Image URLs:** ทั้ง `point.imageUrl` และ `voucher.imageUrl` จะแสดงเมื่อมีข้อมูล

---

## 4. Get Voucher Transactions by Customer Phone (Merchant-Scoped)

**Description:** ดึงประวัติ voucher ownership transactions ของลูกค้าในร้านค้านั้นๆ ด้วยเบอร์โทรศัพท์ (เฉพาะการโอนและแลก voucher)

### Request

**Method:** `GET`

**URL:** `{{endpoint_url}}/:merchantId/transaction/customer/phone/:phone/vouchers`

**Example:** `https://dlp-backofficebe-testnet.adldigitalservice.com/cmih1s6qu00050i01m3cactjj/transaction/customer/phone/0984360421/vouchers`

### Request Parameters

#### Header Fields

| Parameter | Type | M/O | Description | Example |
|-----------|------|-----|-------------|---------|
| x-api-key | String | M | API Key สำหรับ authentication | LEk8YLySHJdMD_nD0cw5 |

#### Path Parameters

| Parameter | Type | M/O | Description | Example |
|-----------|------|-----|-------------|---------|
| merchantId | String | M | รหัสร้านค้า | cmih1s6qu00050i01m3cactjj |
| phone | String | M | เบอร์โทรศัพท์ของลูกค้า (10 digits) | 0984360421 |

### Response

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| transactions | Array | รายการ voucher transactions (VOUCHER_TRANSFER, REDEEM) |
| transactions[].id | String | รหัสธุรกรรม |
| transactions[].transactionHash | String | Transaction hash บน blockchain |
| transactions[].transactionTypeId | String | ประเภทธุรกรรม (VOUCHER_TRANSFER, REDEEM) |
| transactions[].amount | Number | จำนวน voucher (usually 1) |
| transactions[].direction | String | ทิศทางจากมุมมองลูกค้า: `SENT` หรือ `RECEIVED` |
| transactions[].point | Object | ข้อมูล point ที่เกี่ยวข้อง |
| transactions[].point.id | String | รหัส point |
| transactions[].point.name | String | ชื่อ point |
| transactions[].point.symbol | String | สัญลักษณ์ point |
| transactions[].point.imageUrl | String \| null | URL รูปภาพ point logo |
| transactions[].voucher | Object | ข้อมูล voucher |
| transactions[].voucher.id | String | รหัส voucher |
| transactions[].voucher.name | String | ชื่อ voucher |
| transactions[].voucher.valueType | String | ประเภทมูลค่า (cash, percent, free) |
| transactions[].voucher.value | Number | มูลค่า voucher |
| transactions[].voucher.imageUrl | String | URL รูปภาพ voucher |
| transactions[].voucherCodeId | String | รหัส voucher code |
| transactions[].sender | Object | ข้อมูลผู้ส่ง |
| transactions[].receiver | Object | ข้อมูลผู้รับ |
| transactions[].merchant | Object | ข้อมูลร้านค้า |
| transactions[].createdAt | String | วันที่สร้างธุรกรรม (ISO 8601) |
| counts | Number | จำนวน voucher transactions ทั้งหมด |

#### Success Response (200)

```json
{
  "transactions": [
    {
      "id": "cm4voucher123",
      "transactionHash": "0xvoucher123...",
      "transactionTypeId": "REDEEM",
      "amount": 1,
      "direction": "RECEIVED",
      "point": {
        "id": "cm4ohkm5l000099b5ebs3eltd",
        "name": "AIS Points",
        "symbol": "AISP",
        "imageUrl": "https://example.com/images/ais-point.png"
      },
      "voucher": {
        "id": "cm4p9abc123xyz",
        "name": "Starbucks 100 THB",
        "valueType": "cash",
        "value": 100,
        "imageUrl": "https://example.com/images/starbucks.png"
      },
      "voucherCodeId": "cm4vouchercode123",
      "sender": {
        "id": "merchant123",
        "walletAddress": "0xmerchant...",
        "emailOrWebsite": "https://merchant.com"
      },
      "receiver": {
        "id": "cmiisvgqn0007xk01efv8szbq",
        "walletAddress": "0x50581102beb5cdeb68cb5f84acde46fa2deb842e",
        "emailOrWebsite": "customer@example.com"
      },
      "merchant": {
        "id": "cmih1s6qu00050i01m3cactjj",
        "name": "AIS Shop"
      },
      "createdAt": "2025-12-11T14:45:00.000Z"
    }
  ],
  "counts": 1
}
```

### Response Status Codes

| HTTP Status | Status Code | Description |
|-------------|-------------|-------------|
| 200 | 200 | Success - Voucher transactions retrieved |
| 404 | 404 | Not Found - Customer not found |
| 500 | 500 | Internal Server Error |

### Notes

- **Transaction Types Included:** VOUCHER_TRANSFER, REDEEM only
- **Excludes MARKETPLACE_PURCHASE:** ไม่แสดงการซื้อ voucher (อยู่ใน point transactions แทน)
- **Voucher Object:** มีข้อมูลครบถ้วนทุก transaction

---

## 5. Get Global Point Transactions by Customer Phone

**Description:** ดึงประวัติ point transactions ของลูกค้าจากทุก merchants ด้วยเบอร์โทรศัพท์ (ไม่รวม voucher ownership transactions)

### Request

**Method:** `GET`

**URL:** `{{endpoint_url}}/transaction/customer/phone/:phone/points`

**Example:** `https://dlp-backofficebe-testnet.adldigitalservice.com/transaction/customer/phone/0984360421/points`

### Request Parameters

#### Path Parameters

| Parameter | Type | M/O | Description | Example |
|-----------|------|-----|-------------|---------|
| phone | String | M | เบอร์โทรศัพท์ของลูกค้า (10 digits) | 0984360421 |

### Response

#### Response Fields

Same as **Section 3** (Get Point Transactions by Customer Phone) but includes transactions from **all merchants**

| Field | Type | Description |
|-------|------|-------------|
| transactions | Array | รายการ point transactions จากทุก merchants |
| transactions[].merchant | Object | ข้อมูลร้านค้า (แตกต่างกันได้) |
| transactions[].merchant.id | String | รหัสร้านค้า |
| transactions[].merchant.name | String | ชื่อร้านค้า |
| ... | ... | (Fields เหมือน Section 3) |
| counts | Number | จำนวน point transactions ทั้งหมดข้ามทุก merchants |

#### Success Response (200)

```json
{
  "transactions": [
    {
      "id": "cm4p9kv7j003y7w5xhps7krvz",
      "transactionTypeId": "MARKETPLACE_PURCHASE",
      "amount": 100,
      "direction": "SENT",
      "point": {
        "id": "cm4ohkm5l000099b5ebs3eltd",
        "name": "AIS Points",
        "symbol": "AISP",
        "imageUrl": "https://example.com/ais-point.png"
      },
      "voucher": {
        "id": "cm4voucher1",
        "name": "Starbucks 100 THB",
        "valueType": "cash",
        "value": 100,
        "imageUrl": "https://example.com/starbucks.png"
      },
      "merchant": {
        "id": "merchant_ais",
        "name": "AIS Shop"
      },
      "createdAt": "2025-12-11T10:30:00.000Z"
    },
    {
      "id": "cm4another123",
      "transactionTypeId": "TRANSFER",
      "amount": 50,
      "direction": "RECEIVED",
      "point": {
        "id": "point_true",
        "name": "TRUE Points",
        "symbol": "TRUEP",
        "imageUrl": "https://example.com/true-point.png"
      },
      "voucher": null,
      "merchant": {
        "id": "merchant_true",
        "name": "TRUE Shop"
      },
      "createdAt": "2025-12-10T08:15:00.000Z"
    }
  ],
  "counts": 2
}
```

### Response Status Codes

| HTTP Status | Status Code | Description |
|-------------|-------------|-------------|
| 200 | 200 | Success - Global point transactions retrieved |
| 404 | 404 | Not Found - Customer not found |
| 500 | 500 | Internal Server Error |

### Notes

- **Cross-Merchant:** รวม transactions จากทุก merchants ที่ลูกค้าเคยทำธุรกรรม
- **Use Case:** แสดง unified point transaction history ใน customer wallet app
- **Same Structure:** Response structure เหมือน merchant-scoped endpoint

---

## 6. Get Global Voucher Transactions by Customer Phone

**Description:** ดึงประวัติ voucher ownership transactions ของลูกค้าจากทุก merchants ด้วยเบอร์โทรศัพท์

### Request

**Method:** `GET`

**URL:** `{{endpoint_url}}/transaction/customer/phone/:phone/vouchers`

**Example:** `https://dlp-backofficebe-testnet.adldigitalservice.com/transaction/customer/phone/0984360421/vouchers`

### Request Parameters

#### Path Parameters

| Parameter | Type | M/O | Description | Example |
|-----------|------|-----|-------------|---------|
| phone | String | M | เบอร์โทรศัพท์ของลูกค้า (10 digits) | 0984360421 |

### Response

#### Response Fields

Same as **Section 4** (Get Voucher Transactions by Customer Phone) but includes transactions from **all merchants**

#### Success Response (200)

```json
{
  "transactions": [
    {
      "id": "cm4voucher_ais",
      "transactionTypeId": "REDEEM",
      "amount": 1,
      "voucher": {
        "id": "voucher_starbucks",
        "name": "Starbucks 100 THB",
        "valueType": "cash",
        "value": 100,
        "imageUrl": "https://example.com/starbucks.png"
      },
      "merchant": {
        "id": "merchant_ais",
        "name": "AIS Shop"
      },
      "createdAt": "2025-12-11T14:45:00.000Z"
    },
    {
      "id": "cm4voucher_true",
      "transactionTypeId": "VOUCHER_TRANSFER",
      "amount": 1,
      "voucher": {
        "id": "voucher_amazon",
        "name": "Amazon Gift Card 500 THB",
        "valueType": "cash",
        "value": 500,
        "imageUrl": "https://example.com/amazon.png"
      },
      "merchant": {
        "id": "merchant_true",
        "name": "TRUE Shop"
      },
      "createdAt": "2025-12-09T11:20:00.000Z"
    }
  ],
  "counts": 2
}
```

### Response Status Codes

| HTTP Status | Status Code | Description |
|-------------|-------------|-------------|
| 200 | 200 | Success - Global voucher transactions retrieved |
| 404 | 404 | Not Found - Customer not found |
| 500 | 500 | Internal Server Error |

### Notes

- **Cross-Merchant:** รวม voucher transactions จากทุก merchants
- **Use Case:** แสดง unified voucher history ใน customer wallet app

---

## 7. Get All Customer Transaction History

**Description:** ดึงประวัติธุรกรรมทั้งหมดของลูกค้าจากทุก merchants ด้วยเบอร์โทรศัพท์ (รวม point และ voucher transactions)

**💡 Note:** หากต้องการแยกประเภทธุรกรรมชัดเจน สามารถใช้ Section 5 (points) และ Section 6 (vouchers) แทนได้

### Request

**Method:** `GET`

**URL:** `{{endpoint_url}}/transaction/customer/:phone`

**Example:** `https://dlp-backofficebe-testnet.adldigitalservice.com/transaction/customer/0984360421`

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| transactions | Array | รายการธุรกรรม |
| transactions[].id | String | รหัสธุรกรรม |
| transactions[].txHash | String | Transaction hash บน blockchain |
| transactions[].senderAddress | String | Wallet address ของผู้ส่ง |
| transactions[].receiverAddress | String | Wallet address ของผู้รับ |
| transactions[].transactionTypeId | String | ประเภทธุรกรรม (TRANSFER, MINT, BURN, etc.) |
| transactions[].amount | Number | จำนวนคะแนนที่โอน |
| transactions[].transactionDirection | String | ทิศทางธุรกรรมจากมุมมองลูกค้า: `SENT` (จ่าย/ส่งออก) หรือ `RECEIVED` (ได้รับ) |
| transactions[].point | Object | ข้อมูลคะแนน |
| transactions[].point.id | String | รหัสคะแนน |
| transactions[].point.name | String | ชื่อคะแนน |
| transactions[].point.symbol | String | สัญลักษณ์คะแนน |
| transactions[].sender | Object | ข้อมูลผู้ส่ง |
| transactions[].sender.id | String | รหัสผู้ส่ง (Customer ID หรือ Merchant ID) |
| transactions[].sender.walletAddress | String | Wallet address ผู้ส่ง |
| transactions[].sender.emailOrWebsite | String | อีเมลหรือเว็บไซต์ผู้ส่ง |
| transactions[].receiver | Object | ข้อมูลผู้รับ |
| transactions[].receiver.id | String | รหัสผู้รับ (Customer ID หรือ Merchant ID) |
| transactions[].receiver.walletAddress | String | Wallet address ผู้รับ |
| transactions[].receiver.emailOrWebsite | String | อีเมลหรือเว็บไซต์ผู้รับ |
| transactions[].voucherCodeId | String \| null | รหัส voucher code (ถ้ามี) |
| transactions[].eventId | String \| null | รหัสอีเว้นท์ (ถ้ามี) |
| transactions[].createdAt | String | วันที่สร้างธุรกรรม (ISO 8601) |
| counts | Number | จำนวนธุรกรรมทั้งหมด |

#### Success Response (200)

```json
{
  "transactions": [
    {
      "id": "cmiiswd23000axk01f35tq4td",
      "txHash": "0xc24bec9dc9eade84bd15d55386c79b0d858c3b18700be655d17e060eadaadfaf",
      "senderAddress": "0x5291e73df82e9b162ab09b64ba5c0b8d359ebc38",
      "receiverAddress": "0x50581102beb5cdeb68cb5f84acde46fa2deb842e",
      "transactionTypeId": "TRANSFER",
      "amount": 10,
      "transactionDirection": "RECEIVED",
      "point": {
        "id": "cmiimp4g400015v01nv1ij7zf",
        "name": "LAT",
        "symbol": "LAT"
      },
      "sender": {
        "id": "cmih1s6qu00050i01m3cactjj",
        "walletAddress": "0x5291e73df82e9b162ab09b64ba5c0b8d359ebc38",
        "emailOrWebsite": "https://merchant-website.com"
      },
      "receiver": {
        "id": "cmiisvgqn0007xk01efv8szbq",
        "walletAddress": "0x50581102beb5cdeb68cb5f84acde46fa2deb842e",
        "emailOrWebsite": "customer@example.com"
      },
      "voucherCodeId": null,
      "eventId": "event_12345",
      "createdAt": "2025-11-28T11:50:22.491Z"
    }
  ],
  "counts": 1
}
```

### Response Status Codes

| HTTP Status | Status Code | Description |
|-------------|-------------|-------------|
| 200 | 200 | Success - Transaction history retrieved |
| 400 | 400 | Bad Request - Invalid parameters |
| 401 | 401 | Unauthorized - Invalid API Key |
| 404 | 404 | Not Found - Customer or Merchant not found |
| 500 | 500 | Internal Server Error |

---

## 8. Get Merchant Transaction History

**Description:** ดึงประวัติธุรกรรมทั้งหมดของร้านค้า (Public endpoint - ไม่ต้อง authentication)

### Request

**Method:** `GET`

**URL:** `{{endpoint_url}}/:merchantId/transaction`

**Example:** `https://dlp-backofficebe-testnet.adldigitalservice.com/cmih1s6qu00050i01m3cactjj/transaction`

### Request Parameters

#### Path Parameters

| Parameter | Type | M/O | Description | Example |
|-----------|------|-----|-------------|---------|
| merchantId | String | M | รหัสร้านค้า | cmih1s6qu00050i01m3cactjj |

### Response

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| transactions | Array | รายการธุรกรรม |
| transactions[].id | String | รหัสธุรกรรม |
| transactions[].txHash | String | Transaction hash บน blockchain |
| transactions[].senderAddress | String | Wallet address ของผู้ส่ง |
| transactions[].receiverAddress | String | Wallet address ของผู้รับ |
| transactions[].transactionTypeId | String | ประเภทธุรกรรม |
| transactions[].amount | Number | จำนวน (คะแนน/THB/voucher) |
| transactions[].transactionDirection | String | ทิศทางธุรกรรมจากมุมมอง Merchant: `SENT` (จ่าย/ส่งออก) หรือ `RECEIVED` (ได้รับ) |
| transactions[].point | Object \| null | ข้อมูลคะแนน (null ถ้าเป็นธุรกรรม THB/voucher) |
| transactions[].point.id | String | รหัสคะแนน |
| transactions[].point.name | String | ชื่อคะแนน |
| transactions[].point.symbol | String | สัญลักษณ์คะแนน |
| transactions[].sender | Object | ข้อมูลผู้ส่ง |
| transactions[].sender.id | String | รหัสผู้ส่ง |
| transactions[].sender.walletAddress | String | Wallet address ผู้ส่ง |
| transactions[].sender.emailOrWebsite | String | อีเมลหรือเว็บไซต์ผู้ส่ง |
| transactions[].receiver | Object | ข้อมูลผู้รับ |
| transactions[].receiver.id | String | รหัสผู้รับ |
| transactions[].receiver.walletAddress | String | Wallet address ผู้รับ |
| transactions[].receiver.emailOrWebsite | String | อีเมลหรือเว็บไซต์ผู้รับ |
| transactions[].voucherCodeId | String \| null | รหัส voucher code (ถ้ามี) |
| transactions[].eventId | String \| null | รหัสอีเว้นท์ (ถ้ามี) |
| transactions[].createdAt | String | วันที่สร้างธุรกรรม (ISO 8601) |
| counts | Number | จำนวนธุรกรรมทั้งหมด |

#### Success Response (200)

```json
{
  "transactions": [
    {
      "id": "cmipuxvdy000n0obdrgx9pisi",
      "txHash": "0xe754e53e94d92e478fc9cabe6a4eed2e02fc1b86655681e9a0926369eb38f8d8",
      "senderAddress": "0xf5e40ec8bfa4818278c04489b34a486281658e5c",
      "receiverAddress": "0xaa18f00e63efea1de8b18308bf74b740811b3c0f",
      "transactionTypeId": "MERCHANT_PURCHASE_FROM_SELLER",
      "amount": 100,
      "transactionDirection": "SENT",
      "point": null,
      "sender": {
        "id": "cmiptme9o00050oity8rv75bt",
        "walletAddress": "0xf5e40ec8bfa4818278c04489b34a486281658e5c",
        "emailOrWebsite": "https://merchant-website.com"
      },
      "receiver": {
        "id": "seller_address",
        "walletAddress": "0xaa18f00e63efea1de8b18308bf74b740811b3c0f",
        "emailOrWebsite": "https://seller-website.com"
      },
      "voucherCodeId": null,
      "eventId": null,
      "createdAt": "2025-12-03T10:21:55.100Z"
    }
  ],
  "counts": 1
}
```

### Response Status Codes

| HTTP Status | Status Code | Description |
|-------------|-------------|-------------|
| 200 | 200 | Success - Transaction history retrieved |
| 500 | 500 | Internal Server Error |

---

## 9. Get Wallet Balance

**Description:** ดึงข้อมูลยอดคงเหลือของคะแนนในกระเป๋าเงิน

### Request

**Method:** `GET`

**URL:** `{{endpoint_url}}/transaction/:walletAddress/:pointId/balance`

**Example:** `https://dlp-backofficebe-testnet.adldigitalservice.com/transaction/0x50581102bEB5cDEb68cB5f84ACdE46fa2DeB842E/cmiimp4g400015v01nv1ij7zf/balance`

### Request Parameters

#### Path Parameters

| Parameter | Type | M/O | Description | Example |
|-----------|------|-----|-------------|---------|
| walletAddress | String | M | Wallet address ของลูกค้า | 0x50581102bEB5cDEb68cB5f84ACdE46fa2DeB842E |
| pointId | String | M | รหัสคะแนน | cmiimp4g400015v01nv1ij7zf |

### Response

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| walletAddress | String | Wallet address ของลูกค้า |
| pointId | String | รหัสคะแนน |
| balance | Number | ยอดคะแนนคงเหลือ |
| point | Object | ข้อมูลคะแนน |
| point.id | String | รหัสคะแนน |
| point.name | String | ชื่อคะแนน |
| point.symbol | String | สัญลักษณ์คะแนน |
| point.contractAddress | String | Contract address บน blockchain |

#### Success Response (200)

```json
{
  "walletAddress": "0x50581102bEB5cDEb68cB5f84ACdE46fa2DeB842E",
  "pointId": "cmiimp4g400015v01nv1ij7zf",
  "balance": 100,
  "point": {
    "id": "cmiimp4g400015v01nv1ij7zf",
    "name": "LAT",
    "symbol": "LAT",
    "contractAddress": "0x1234567890abcdef1234567890abcdef12345678"
  }
}
```

### Response Status Codes

| HTTP Status | Status Code | Description |
|-------------|-------------|-------------|
| 200 | 200 | Success - Balance retrieved |
| 400 | 400 | Bad Request - Invalid parameters |
| 404 | 404 | Not Found - Wallet or Point not found |
| 500 | 500 | Internal Server Error |

---

## 10. Redeem Voucher

**Description:** ใช้ voucher code เพื่อแลกรับส่วนลดหรือของรางวัล

### Request

**Method:** `POST`

**URL:** `{{endpoint_url}}/coupon/redeem`

**Example:** `https://dlp-backofficebe-testnet.adldigitalservice.com/coupon/redeem`

### Request Parameters

#### Request Body

##### Request Body Fields

| Parameter | Type | M/O | Description | Example |
|-----------|------|-----|-------------|---------|
| code | String | M | รหัส voucher code | WELCOME2024 |
| phone | String | M | เบอร์โทรศัพท์ของลูกค้า | 0984360421 |
| merchantRef | String | M | รหัสอ้างอิงร้านค้า | merchant-ref-001 |

**Example Request Body:**
```json
{
  "code": "WELCOME2024",
  "phone": "0984360421",
  "merchantRef": "merchant-ref-001"
}
```

### Response

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| success | Boolean | สถานะความสำเร็จ |
| message | String | ข้อความตอบกลับ |
| voucher | Object | ข้อมูล voucher |
| voucher.id | String | รหัส voucher |
| voucher.name | String | ชื่อ voucher |
| voucher.description | String | รายละเอียด voucher |
| voucher.valueType | String | ประเภทส่วนลด (percentage, cash, gift, etc.) |
| voucher.value | Number | มูลค่าส่วนลด |
| voucher.merchantName | String | ชื่อร้านค้า |
| voucher.startDate | String | วันที่เริ่มใช้งาน (ISO 8601) |
| voucher.endDate | String | วันที่หมดอายุ (ISO 8601) |
| redemption | Object | ข้อมูลการแลก voucher |
| redemption.code | String | รหัส voucher code ที่ใช้ |
| redemption.redeemedBy | String | รหัสลูกค้าที่แลก |
| redemption.redeemedAt | String | วันที่แลก (ISO 8601) |
| redemption.pointsCost | Number | จำนวนคะแนนที่ใช้ |
| blockchain | Object | ข้อมูล blockchain transaction |
| blockchain.transactionHash | String | Transaction hash บน blockchain |
| blockchain.blockNumber | Number | Block number |
| vaultRelease | Object \| null | ข้อมูลการปลดล็อค vault (ถ้ามี) |

#### Success Response (200)

```json
{
  "success": true,
  "message": "Voucher redeemed successfully",
  "voucher": {
    "id": "voucher-mock-1",
    "name": "Welcome Discount 20%",
    "description": "Get 20% off on your first purchase",
    "valueType": "percentage",
    "value": 20,
    "merchantName": "Test Merchant",
    "startDate": "2025-11-28T11:50:32.760Z",
    "endDate": "2025-12-28T11:50:32.760Z"
  },
  "redemption": {
    "code": "WELCOME2024",
    "redeemedBy": "cmiisvgqn0007xk01efv8szbq",
    "redeemedAt": "2025-12-01T06:30:00.000Z",
    "pointsCost": 100
  },
  "blockchain": {
    "transactionHash": "0xc24bec9dc9eade84bd15d55386c79b0d858c3b18700be655d17e060eadaadfaf",
    "blockNumber": 12345678
  },
  "vaultRelease": null
}
```

#### Error Responses

**Code Not Found (404)**
```json
{
  "statusCode": 404,
  "message": "Voucher code \"INVALID123\" not found"
}
```

**Code Already Used (400)**
```json
{
  "statusCode": 400,
  "message": "Voucher code has already been redeemed by customer: cmiisvgqn0007xk01efv8szbq"
}
```

**Voucher Expired (400)**
```json
{
  "statusCode": 400,
  "message": "Voucher has expired on 2025-11-28T11:50:32.760Z"
}
```

**Wrong Merchant (400)**
```json
{
  "statusCode": 400,
  "message": "This voucher can only be redeemed at the issuing merchant"
}
```

**Insufficient Balance (400)**
```json
{
  "statusCode": 400,
  "message": "Insufficient on-chain coupon balance for redemption"
}
```

### Response Status Codes

| HTTP Status | Status Code | Description |
|-------------|-------------|-------------|
| 200 | 200 | Success - Voucher redeemed |
| 400 | 400 | Bad Request - Code already used, expired, wrong merchant, or insufficient balance |
| 404 | 404 | Not Found - Code or customer not found |
| 500 | 500 | Internal Server Error |

---

## 11. Redeem AIS Voucher (Transfer Points to Another Customer)

**Description:** แลก voucher ประเภท AIS Point โดยโอนคะแนนไปให้เบอร์โทรศัพท์อื่น (Public endpoint - ไม่ต้อง authenticate)

### Request

**Method:** `POST`

**URL:** `{{endpoint_url}}/coupon/redeem-ais`

**Example:** `https://dlp-backofficebe-testnet.adldigitalservice.com/coupon/redeem-ais`

### Request Parameters

#### Body (JSON)

```json
{
  "code": "AIS2024WELCOME",
  "phone": "0984360421",
  "merchantRef": "merchant-ref-001",
  "receiverPhone": "0987654321"
}
```

| Parameter | Type | M/O | Description | Example |
|-----------|------|-----|-------------|---------|
| code | String | M | รหัส voucher ที่ต้องการแลก | AIS2024WELCOME |
| phone | String | M | เบอร์โทรศัพท์ของผู้แลก voucher | 0984360421 |
| merchantRef | String | M | Reference ของร้านค้า (ต้องตรงกับ voucher.merchantRef) | merchant-ref-001 |
| receiverPhone | String | M | เบอร์โทรศัพท์ของผู้รับคะแนน AIS Point (ต้องไม่ซ้ำกับ phone) | 0987654321 |

### Response

#### Success Response (200)

```json
{
  "status": "success",
  "message": "OK",
  "data": {
    "success": true,
    "message": "Voucher redeemed successfully",
    "voucher": {
      "id": "voucher123",
      "name": "AIS Point 100",
      "description": "Get 100 AIS Points",
      "valueType": "aispoint",
      "value": 100,
      "merchantName": "AIS Shop",
      "startDate": "2024-01-01T00:00:00.000Z",
      "endDate": "2024-12-31T23:59:59.000Z"
    },
    "redemption": {
      "code": "AIS2024WELCOME",
      "redeemedBy": "customer-id-123",
      "redeemedAt": "2024-12-04T10:30:00.000Z",
      "pointsCost": 50
    },
    "blockchain": {
      "transactionHash": "0xabc123...",
      "blockNumber": 12345
    },
    "vaultRelease": {
      "transactionHash": "0xdef456...",
      "blockNumber": 12346
    },
    "pointTransfer": {
      "phone": "0984360421",
      "receiverPhone": "0987654321",
      "amount": 100
    }
  }
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| status | String | สถานะการตอบกลับ ("success") |
| message | String | ข้อความสถานะ ("OK") |
| data | Object | ข้อมูลผลลัพธ์การแลก |
| data.success | Boolean | สถานะความสำเร็จ |
| data.message | String | ข้อความอธิบาย |
| data.voucher | Object | ข้อมูล voucher ที่แลก |
| data.voucher.id | String | รหัส voucher |
| data.voucher.name | String | ชื่อ voucher |
| data.voucher.description | String | รายละเอียด voucher |
| data.voucher.valueType | String | ประเภทคูปอง (aispoint) |
| data.voucher.value | Number | มูลค่าของ voucher (จำนวน AIS Point) |
| data.voucher.merchantName | String | ชื่อร้านค้า |
| data.voucher.startDate | String | วันที่เริ่มใช้งาน |
| data.voucher.endDate | String | วันที่หมดอายุ |
| data.redemption | Object | ข้อมูลการแลก |
| data.redemption.code | String | รหัส voucher ที่แลก |
| data.redemption.redeemedBy | String | รหัสลูกค้าผู้แลก |
| data.redemption.redeemedAt | String | วันเวลาที่แลก (ISO 8601) |
| data.redemption.pointsCost | Number | คะแนนที่ใช้ในการแลก |
| data.blockchain | Object/null | ข้อมูล transaction บน blockchain |
| data.blockchain.transactionHash | String | Hash ของ transaction |
| data.blockchain.blockNumber | Number | หมายเลข block |
| data.vaultRelease | Object/null | ข้อมูล vault release transaction |
| data.vaultRelease.transactionHash | String | Hash ของ transaction |
| data.vaultRelease.blockNumber | Number | หมายเลข block |
| data.pointTransfer | Object | ข้อมูลการโอนคะแนน AIS Point |
| data.pointTransfer.phone | String | เบอร์โทรผู้แลก (ผู้โอน) |
| data.pointTransfer.receiverPhone | String | เบอร์โทรผู้รับ |
| data.pointTransfer.amount | Number | จำนวนคะแนน AIS Point ที่โอน |

### Error Responses

**Code Not Found (404)**
```json
{
  "statusCode": 404,
  "message": "Voucher code not found",
  "error": "Not Found"
}
```

**Customer Not Found (404)**
```json
{
  "statusCode": 404,
  "message": "Customer with phone 0984360421 not found",
  "error": "Not Found"
}
```

**Receiver Not Found (404)**
```json
{
  "statusCode": 404,
  "message": "Receiver customer with phone 0987654321 not found",
  "error": "Not Found"
}
```

**Same Phone Number (400)**
```json
{
  "statusCode": 400,
  "message": "Receiver phone must be different from redeemer phone",
  "error": "Bad Request"
}
```

**Wrong Voucher Type (400)**
```json
{
  "statusCode": 400,
  "message": "This endpoint is only for AIS Point vouchers. Use /coupon/redeem for other voucher types.",
  "error": "Bad Request"
}
```

**Code Already Used (400)**
```json
{
  "statusCode": 400,
  "message": "Voucher code has already been redeemed by customer: customer-id-456",
  "error": "Bad Request"
}
```

**Voucher Expired (400)**
```json
{
  "statusCode": 400,
  "message": "Voucher has expired on 2024-11-30T23:59:59.000Z",
  "error": "Bad Request"
}
```

**Wrong Merchant (400)**
```json
{
  "statusCode": 400,
  "message": "This voucher can only be redeemed at the issuing merchant",
  "error": "Bad Request"
}
```

**Insufficient Balance (400)**
```json
{
  "statusCode": 400,
  "message": "Insufficient on-chain coupon balance for redemption",
  "error": "Bad Request"
}
```

### Response Status Codes

| HTTP Status | Status Code | Description |
|-------------|-------------|-------------|
| 200 | 200 | Success - Voucher redeemed and points transfer prepared |
| 400 | 400 | Bad Request - Same phone, wrong type, code used, expired, wrong merchant, or insufficient balance |
| 404 | 404 | Not Found - Code, redeemer, or receiver not found |
| 500 | 500 | Internal Server Error |

### Notes

- This endpoint is **public** and does not require authentication
- Only works with vouchers of type **`aispoint`** (VoucherValueType.aispoint)
- The `phone` and `receiverPhone` must be **different** phone numbers
- Both phone numbers must exist in the customer database
- The `pointTransfer.amount` equals the voucher's `value` field (AIS points)
- The `redemption.pointsCost` is the points spent by the customer to obtain the voucher
- The `merchantRef` must match the voucher's `merchantRef` field (if set)
- Actual AIS point transfer integration is pending (TODO in code)

---

## Transaction Direction Field

ฟิลด์ `transactionDirection` แสดงทิศทางของธุรกรรมจากมุมมองของผู้ใช้ (Customer หรือ Merchant):

### สำหรับ Customer
- **`SENT`**: ลูกค้าเป็นผู้ส่ง/จ่าย (senderId = customerId)
  - ตัวอย่าง: ซื้อ voucher, โอนคะแนนให้คนอื่น, แลกของรางวัล
- **`RECEIVED`**: ลูกค้าเป็นผู้รับ (receiverId = customerId)
  - ตัวอย่าง: ได้รับคะแนนจากร้านค้า, รับคะแนนจากคนอื่น

### สำหรับ Merchant
- **`SENT`**: ร้านค้าเป็นผู้ส่ง/จ่าย
  - เงื่อนไข: senderId = null (B2C) หรือ merchantSenderId = merchantId
  - ตัวอย่าง: ส่งคะแนนให้ลูกค้า (B2C), ซื้อ voucher จาก seller
- **`RECEIVED`**: ร้านค้าเป็นผู้รับ
  - เงื่อนไข: senderId ≠ null (Customer จ่าย) หรือ merchantReceiverId = merchantId
  - ตัวอย่าง: ลูกค้าซื้อ voucher, ลูกค้าแลกของรางวัล

---

## Transaction Types

ประเภทธุรกรรม (`transactionTypeId`) ที่มีในระบบ:

| Transaction Type | Description | Use Case |
|-----------------|-------------|----------|
| **TRANSFER** | โอนคะแนนปกติ | - ร้านค้าส่งคะแนนให้ลูกค้า (B2C)<br>- ลูกค้าโอนคะแนนให้กัน (C2C) |
| **MINT** | สร้างคะแนนใหม่ | - Merchant mint คะแนนเพิ่มในระบบ |
| **BURN** | ทำลายคะแนน | - ลบคะแนนออกจากระบบ |
| **EARN** | รับคะแนนจากกิจกรรม | - รับคะแนนจากการทำภารกิจ/event |
| **REDEEM** | แลกของรางวัล | - ลูกค้าใช้คะแนนแลกของรางวัล |
| **MARKETPLACE_PURCHASE** | ซื้อ voucher จาก marketplace | - ลูกค้าซื้อ voucher ด้วยคะแนน |
| **MERCHANT_PURCHASE_FROM_SELLER** | Merchant ซื้อ voucher จาก seller | - ร้านค้าซื้อ voucher ด้วย THB |
| **VOUCHER_TRANSFER** | โอน voucher | - โอน voucher ระหว่าง user |
| **VOUCHER_GIFT** | ให้ voucher เป็นของขวัญ | - ส่ง voucher เป็นของขวัญ |

---

## Customer Registration

### Register Customer

**Description:** Create a temporary registration link for customer onboarding. This generates a unique URL with OTP that expires in 5 minutes.

**Method:** `POST`

**URL:** `{{endpoint_url}}/:merchantId/customer/register`

**Example:** `https://dlp-backofficebe-testnet.adldigitalservice.com/cmih1s6qu00050i01m3cactjj/customer/register?callbackUri=https://example.com`

**Authentication:** Public endpoint (no API key required)

### Request Parameters

#### Path Parameters

| Parameter | Type | M/O | Description | Example |
|-----------|------|-----|-------------|---------|
| merchantId | String | M | Merchant ID (alphanumeric, hyphens, underscores) | cmih1s6qu00050i01m3cactjj |

#### Query Parameters

| Parameter | Type | M/O | Description | Example |
|-----------|------|-----|-------------|---------|
| callbackUri | String | O | URL to redirect after registration (must be valid URL) | https://example.com |

### Response

#### Success Response (201)

```json
{
  "url": "https://frontend-url.com/otp?requestid=550e8400-e29b-41d4-a716-446655440000&merchantId=cmih1s6qu00050i01m3cactjj&callbackUri=https://example.com",
  "callbackUrl": "https://example.com",
  "merchantId": "cmih1s6qu00050i01m3cactjj"
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| url | String | Complete registration URL with embedded requestId, merchantId, and callbackUri |
| callbackUrl | String | The callback URL provided in request (or empty string) |
| merchantId | String | The merchant ID |

#### Error Responses

**400 - Merchant Not Found**

```json
{
  "statusCode": 400,
  "message": "Merchant not found",
  "error": "MERCHANT_NOT_FOUND"
}
```

**400 - Invalid Parameters**

```json
{
  "statusCode": 400,
  "message": [
    "merchantId must contain only alphanumeric characters, hyphens, and underscores",
    "callbackUri must be a valid URL"
  ]
}
```

**500 - Internal Server Error**

```json
{
  "statusCode": 500,
  "message": "Failed to register customer"
}
```

### Registration Flow

1. **Call Register Endpoint** - POST to `/:merchantId/customer/register` with optional `callbackUri`
2. **Receive Registration URL** - Get unique URL with embedded `requestId` and 5-minute expiry
3. **Customer Opens URL** - Direct customer to the registration URL
4. **Send OTP** - POST to `/templink/send-otp` with `requestId` and `phoneNumber`
5. **Verify OTP** - POST to `/templink/verify-otp` with `phoneNumber` and `otpCode`
6. **Complete Registration** - Customer is registered and temp link is deleted

### Notes

- The `requestId` in the returned URL is used for subsequent OTP operations
- OTP expires after 5 minutes from registration link creation
- Temp link is automatically created with a 6-digit OTP
- The registration URL should be sent to the customer (via SMS, email, etc.)
- After successful OTP verification, the temp link is deleted automatically

---

## Notes

- **M/O** = Mandatory/Optional
- All timestamps are in ISO 8601 format (UTC)
- API Key must be included in the `x-api-key` header for all requests (except public endpoints like redeem and merchant transaction history)
- Phone numbers should be in Thai format (10 digits starting with 0)
- The `eventId` field in transaction responses is optional and used for tracking specific events
- Voucher redemption and merchant transaction history are public endpoints and do not require authentication
- Balance endpoint is also public for easy access
- `transactionDirection` is a computed field based on sender/receiver relationship, not stored in database
