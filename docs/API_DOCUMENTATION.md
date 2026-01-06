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
| type | String \| null | ประเภท asset: `POINT` หรือ `VOUCHER` |
| transactionRefId | String \| null | UUID สำหรับ link transactions ที่เกี่ยวข้อง |
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
  "type": "POINT",
  "transactionRefId": "550e8400-e29b-41d4-a716-446655440000",
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
| transactions | Array | รายการ point transactions (MINT, TRANSFER, BURN, EARN) |
| transactions[].id | String | รหัสธุรกรรม |
| transactions[].transactionHash | String | Transaction hash บน blockchain |
| transactions[].transactionTypeId | String | ประเภทธุรกรรม (MINT, TRANSFER, BURN, EARN) |
| transactions[].amount | Number | จำนวน point |
| transactions[].direction | String | ทิศทางจากมุมมองลูกค้า: `SENT` หรือ `RECEIVED` |
| transactions[].point | Object | ข้อมูล point |
| transactions[].point.id | String | รหัส point |
| transactions[].point.name | String | ชื่อ point |
| transactions[].point.symbol | String | สัญลักษณ์ point |
| transactions[].point.imageUrl | String \| null | URL รูปภาพ point logo |
| transactions[].voucher | Object \| null | ข้อมูล voucher (สำหรับการซื้อ voucher - link ด้วย transactionRefId) |
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
      "transactionTypeId": "TRANSFER",
      "amount": 100,
      "transactionDirection": "SENT",
      "transactionRefId": "550e8400-e29b-41d4-a716-446655440000",
      "point": {
        "id": "cm4ohkm5l000099b5ebs3eltd",
        "name": "AIS Points",
        "symbol": "AISP",
        "imageUrl": "https://example.com/images/ais-point.png"
      },
      "voucher": null,
      "voucherCodeId": null,
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
      "transactionDirection": "RECEIVED",
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

- **Transaction Types Included:** MINT, TRANSFER, BURN, EARN
- **Voucher Purchase:** ใช้ `transactionRefId` (UUID) เชื่อมโยง TRANSFER (point) กับ VOUCHER_TRANSFER (voucher)
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
      "transactionDirection": "RECEIVED",
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
- **Voucher Purchase:** การซื้อ voucher จะแสดงเป็น TRANSFER (type: POINT) และ VOUCHER_TRANSFER เชื่อมด้วย transactionRefId
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
      "transactionTypeId": "TRANSFER",
      "transactionRefId": "550e8400-e29b-41d4-a716-446655440000",
      "amount": 100,
      "transactionDirection": "SENT",
      "point": {
        "id": "cm4ohkm5l000099b5ebs3eltd",
        "name": "AIS Points",
        "symbol": "AISP",
        "imageUrl": "https://example.com/ais-point.png"
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
      "transactionDirection": "RECEIVED",
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
      "transactionDirection": "SENT",
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
      "transactionDirection": "RECEIVED",
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
| voucher.imageUrl | String \| null | URL รูปภาพของ voucher |
| redemption | Object | ข้อมูลการแลก voucher |
| redemption.code | String | รหัส voucher code ที่ใช้ |
| redemption.redeemedBy | String | รหัสลูกค้าที่แลก |
| redemption.redeemedAt | String | วันที่แลก (ISO 8601) |
| redemption.pointsCost | Number | จำนวนคะแนนที่ใช้ |
| transaction | Object | ข้อมูล transaction บนระบบ |
| transaction.id | String | รหัส transaction |
| transaction.txHash | String | Transaction hash |
| transaction.senderAddress | String | Wallet address ผู้ส่ง |
| transaction.receiverAddress | String | Wallet address ผู้รับ |
| transaction.transactionTypeId | Number | รหัสประเภท transaction |
| transaction.amount | Number | จำนวนที่โอน |
| transaction.transactionDirection | String | ทิศทางการทำธุรกรรม (SENT/RECEIVED) |
| transaction.merchant | Object | ข้อมูลร้านค้า |
| transaction.merchant.id | String | รหัสร้านค้า |
| transaction.merchant.name | String | ชื่อร้านค้า |
| transaction.merchant.imageUrl | String \| null | URL รูปภาพร้านค้า |
| transaction.point | Object \| null | ข้อมูลคะแนน/สกุลเงิน |
| transaction.sender | Object | ข้อมูลผู้ส่ง |
| transaction.receiver | Object | ข้อมูลผู้รับ |
| transaction.voucher | Object \| null | ข้อมูล voucher |
| transaction.voucher.id | String | รหัส voucher |
| transaction.voucher.name | String | ชื่อ voucher |
| transaction.voucher.valueType | String | ประเภทส่วนลด |
| transaction.voucher.value | Number | มูลค่าส่วนลด |
| transaction.voucher.merchantRef | String \| null | รหัสอ้างอิงจาก merchant |
| transaction.typeAsset | String | ประเภท asset (POINT หรือ VOUCHER) |
| transaction.createdAt | String | วันที่สร้าง transaction (ISO 8601) |
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
    "imageUrl": "https://example.com/voucher.jpg",
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
  "transaction": {
    "id": "cm4abc123xyz",
    "txHash": "0xc24bec9dc9eade84bd15d55386c79b0d858c3b18700be655d17e060eadaadfaf",
    "senderAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
    "receiverAddress": "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199",
    "transactionTypeId": 7,
    "amount": 1,
    "transactionDirection": "SENT",
    "merchant": {
      "id": "merchant123",
      "name": "Test Merchant",
      "imageUrl": "https://example.com/merchant.png"
    },
    "point": null,
    "sender": {
      "id": "cmiisvgqn0007xk01efv8szbq",
      "walletAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
      "emailOrWebsite": "customer@example.com"
    },
    "receiver": {
      "id": "merchant123",
      "walletAddress": "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199",
      "emailOrWebsite": "merchant@example.com"
    },
    "voucher": {
      "id": "voucher-mock-1",
      "tokenId": "123",
      "name": "Welcome Discount 20%",
      "description": "Get 20% off on your first purchase",
      "valueType": "percentage",
      "value": 20,
      "currency": null,
      "imageUrl": "https://example.com/voucher.jpg",
      "startDate": "2025-11-28T11:50:32.760Z",
      "endDate": "2025-12-28T11:50:32.760Z",
      "merchantRef": "merchant-ref-001"
    },
    "eventId": null,
    "transactionRefId": "550e8400-e29b-41d4-a716-446655440000",
    "typeAsset": "VOUCHER",
    "createdAt": "2025-12-01T06:30:00.000Z"
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
      "imageUrl": "https://example.com/ais-voucher.jpg",
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
    "transaction": {
      "id": "cm4txn123xyz",
      "txHash": "0xabc123def456...",
      "senderAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
      "receiverAddress": "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199",
      "transactionTypeId": 7,
      "amount": 1,
      "transactionDirection": "SENT",
      "merchant": {
        "id": "merchant123",
        "name": "AIS Shop",
        "imageUrl": "https://example.com/ais-merchant.png"
      },
      "point": null,
      "sender": {
        "id": "customer-id-123",
        "walletAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
        "emailOrWebsite": "customer@example.com"
      },
      "receiver": {
        "id": "merchant123",
        "walletAddress": "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199",
        "emailOrWebsite": "ais@example.com"
      },
      "voucher": {
        "id": "voucher123",
        "tokenId": "456",
        "name": "AIS Point 100",
        "description": "Get 100 AIS Points",
        "valueType": "aispoint",
        "value": 100,
        "currency": null,
        "imageUrl": "https://example.com/ais-voucher.jpg",
        "startDate": "2024-01-01T00:00:00.000Z",
        "endDate": "2024-12-31T23:59:59.000Z",
        "merchantRef": "AIS-VOUCHER-001"
      },
      "eventId": null,
      "transactionRefId": "550e8400-e29b-41d4-a716-446655440001",
      "typeAsset": "VOUCHER",
      "createdAt": "2024-12-04T10:30:00.000Z"
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
| data.voucher.imageUrl | String \| null | URL รูปภาพของ voucher |
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
| data.transaction | Object | ข้อมูล transaction บนระบบ |
| data.transaction.id | String | รหัส transaction |
| data.transaction.txHash | String | Transaction hash |
| data.transaction.senderAddress | String | Wallet address ผู้ส่ง |
| data.transaction.receiverAddress | String | Wallet address ผู้รับ |
| data.transaction.transactionTypeId | Number | รหัสประเภท transaction |
| data.transaction.amount | Number | จำนวนที่โอน |
| data.transaction.transactionDirection | String | ทิศทางการทำธุรกรรม (SENT/RECEIVED) |
| data.transaction.merchantId | String | รหัสร้านค้า |
| data.transaction.merchantName | String | ชื่อร้านค้า |
| data.transaction.point | Object \| null | ข้อมูลคะแนน/สกุลเงิน |
| data.transaction.sender | Object | ข้อมูลผู้ส่ง |
| data.transaction.receiver | Object | ข้อมูลผู้รับ |
| data.transaction.voucherCodeId | String | รหัส voucher code |
| data.transaction.valueType | String | ประเภทส่วนลด |
| data.transaction.value | Number | มูลค่าส่วนลด |
| data.transaction.createdAt | String | วันที่สร้าง transaction (ISO 8601) |
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
| **MERCHANT_PURCHASE_FROM_SELLER** | Merchant ซื้อ voucher จาก seller | - ร้านค้าซื้อ voucher ด้วย THB |
| **VOUCHER_TRANSFER** | โอน voucher | - โอน voucher ระหว่าง user |
| **VOUCHER_GIFT** | ให้ voucher เป็นของขวัญ | - ส่ง voucher เป็นของขวัญ |

---

## Transaction Asset Type (type)

ฟิลด์ `type` แสดงประเภทของ asset ในธุรกรรม:

| Type | Description | Transaction Types |
|------|-------------|-------------------|
| **POINT** | ธุรกรรมเกี่ยวกับ Point token | TRANSFER, MINT, BURN, EARN |
| **VOUCHER** | ธุรกรรมเกี่ยวกับ Voucher/Coupon | VOUCHER_TRANSFER, VOUCHER_GIFT, REDEEM, MERCHANT_PURCHASE_FROM_SELLER |

### หมายเหตุ
- `type` อาจเป็น `null` สำหรับ transactions เก่าที่สร้างก่อนการเพิ่ม field นี้
- ใช้สำหรับ filter transactions ตามประเภท asset

---

## Transaction Reference ID (transactionRefId)

ฟิลด์ `transactionRefId` เป็น UUID ที่ใช้เชื่อมโยง transactions ที่เกี่ยวข้องกัน:

### Use Cases
- **Marketplace Purchase:** เมื่อลูกค้าซื้อ voucher จะสร้าง 2 transactions ที่มี `transactionRefId` เดียวกัน:
  1. `TRANSFER` (type: POINT) - หัก point จากลูกค้า
  2. `VOUCHER_TRANSFER` (type: VOUCHER) - โอน voucher ให้ลูกค้า

### ตัวอย่าง
```json
{
  "transaction1": {
    "id": "txn-001",
    "transactionTypeId": "TRANSFER",
    "type": "POINT",
    "transactionRefId": "550e8400-e29b-41d4-a716-446655440000",
    "amount": 100
  },
  "transaction2": {
    "id": "txn-002",
    "transactionTypeId": "VOUCHER_TRANSFER",
    "type": "VOUCHER",
    "transactionRefId": "550e8400-e29b-41d4-a716-446655440000",
    "amount": 1
  }
}
```

### หมายเหตุ
- `transactionRefId` อาจเป็น `null` สำหรับ transactions ที่ไม่มีความสัมพันธ์กับ transactions อื่น
- ใช้สำหรับ query transactions ที่เกิดขึ้นพร้อมกันจากการกระทำเดียว

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

## 13. Get Point by ID

**Description:** ดึงข้อมูล Point ด้วย ID พร้อม merchant info และ statistics

### Request

**Method:** `GET`

**URL:** `{{endpoint_url}}/points/:pointId`

**Example:** `https://dlp-backofficebe-testnet.adldigitalservice.com/points/cmiimp4g400015v01nv1ij7zf`

**Authentication:** Public (ไม่ต้องใช้ API Key)

### Request Parameters

#### Path Parameters

| Parameter | Type | M/O | Description | Example |
|-----------|------|-----|-------------|---------|
| pointId | String | M | รหัส Point | cmiimp4g400015v01nv1ij7zf |

### Response

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| point | Object | ข้อมูล Point |
| point.id | String | รหัส Point |
| point.name | String | ชื่อ Point |
| point.symbol | String | Symbol ของ Point |
| point.contractAddress | String | Contract address (hex format) |
| point.initialSupply | Number | จำนวน supply เริ่มต้น |
| point.decimal | Number | จำนวนทศนิยม |
| point.startDate | String \| null | วันเริ่มต้น |
| point.endDate | String | วันหมดอายุ |
| point.epochDuration | Number | ระยะเวลา 1 epoch (seconds) |
| point.imageUrl | String \| null | URL รูปภาพ |
| point.merchantId | String \| null | รหัส Merchant |
| point.merchant | Object \| null | ข้อมูล Merchant |
| point.merchant.id | String | รหัส Merchant |
| point.merchant.name | String | ชื่อ Merchant |
| point.merchant.description | String \| null | คำอธิบาย |
| point.merchant.imageUrl | String \| null | URL รูปภาพ |
| point.merchant.website | String \| null | Website |
| point.statistics | Object | สถิติ |
| point.statistics.totalTransactions | Number | จำนวน transactions ทั้งหมด |
| point.statistics.totalCustomers | Number | จำนวนลูกค้าทั้งหมด |
| point.statistics.totalBalance | Number | ยอด balance รวม |
| point.statistics.initialSupply | Number | จำนวน supply เริ่มต้น |
| point.statistics.circulatingSupply | Number | จำนวน supply ที่หมุนเวียน |

#### Success Response (200)

```json
{
  "point": {
    "id": "cmiimp4g400015v01nv1ij7zf",
    "name": "LAT",
    "symbol": "LAT",
    "contractAddress": "0x1234567890abcdef1234567890abcdef12345678",
    "initialSupply": 1000000,
    "decimal": 18,
    "startDate": "2025-01-01T00:00:00.000Z",
    "endDate": "2026-01-01T00:00:00.000Z",
    "epochDuration": 259200,
    "imageUrl": "https://example.com/point.png",
    "merchantId": "cmih1s6qu00050i01m3cactjj",
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z",
    "merchant": {
      "id": "cmih1s6qu00050i01m3cactjj",
      "name": "Example Merchant",
      "description": "A sample merchant",
      "imageUrl": "https://example.com/merchant.png",
      "website": "https://example.com"
    },
    "statistics": {
      "totalTransactions": 150,
      "totalCustomers": 50,
      "totalBalance": 500000,
      "initialSupply": 1000000,
      "circulatingSupply": 500000
    }
  }
}
```

#### Error Response (404)

```json
{
  "statusCode": 404,
  "message": "Point not found"
}
```

---

## 14. Get Transaction by ID

**Description:** ดึงข้อมูล Transaction ด้วย ID

### Request

**Method:** `GET`

**URL:** `{{endpoint_url}}/transaction/:id`

**Example:** `https://dlp-backofficebe-testnet.adldigitalservice.com/transaction/cm4abc123xyz`

**Authentication:** Public (ไม่ต้องใช้ API Key)

### Request Parameters

#### Path Parameters

| Parameter | Type | M/O | Description | Example |
|-----------|------|-----|-------------|---------|
| id | String | M | รหัส Transaction | cm4abc123xyz |

### Response

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| id | String | รหัส Transaction |
| txHash | String | Transaction hash (hex format) |
| senderAddress | String | Wallet address ผู้ส่ง |
| receiverAddress | String | Wallet address ผู้รับ |
| transactionTypeId | String | ประเภท transaction |
| amount | Number | จำนวน |
| transactionDirection | String | ทิศทาง: `SENT` หรือ `RECEIVED` |
| merchant | Object \| null | ข้อมูล Merchant |
| merchant.id | String | รหัส Merchant |
| merchant.name | String | ชื่อ Merchant |
| merchant.imageUrl | String \| null | URL รูป Merchant |
| point | Object \| null | ข้อมูล Point (null สำหรับ voucher transactions) |
| sender | Object \| null | ข้อมูลผู้ส่ง |
| receiver | Object \| null | ข้อมูลผู้รับ |
| voucher | Object \| null | ข้อมูล Voucher (ถ้ามี) |
| voucher.id | String | รหัส Voucher |
| voucher.tokenId | String | Token ID บน blockchain |
| voucher.name | String | ชื่อ Voucher |
| voucher.description | String | คำอธิบาย Voucher |
| voucher.valueType | String | ประเภทมูลค่า |
| voucher.value | Number | มูลค่า |
| voucher.currency | String \| null | สกุลเงิน |
| voucher.imageUrl | String \| null | URL รูป Voucher |
| voucher.startDate | String | วันที่เริ่มต้น |
| voucher.endDate | String | วันที่สิ้นสุด |
| voucher.merchantRef | String \| null | Merchant Reference |
| typeAsset | String | ประเภท Asset: `POINT` หรือ `VOUCHER` |
| transactionRefId | String \| null | Reference ID สำหรับอ้างอิง |
| eventId | String \| null | รหัส Event |
| createdAt | String | วันที่สร้าง |

#### Success Response (200)

```json
{
  "id": "cm4abc123xyz",
  "txHash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  "senderAddress": "0x50581102bEB5cDEb68cB5f84ACdE46fa2DeB842E",
  "receiverAddress": "0x60581102bEB5cDEb68cB5f84ACdE46fa2DeB843F",
  "transactionTypeId": "B2C",
  "amount": 100,
  "transactionDirection": "SENT",
  "merchant": {
    "id": "cmih1s6qu00050i01m3cactjj",
    "name": "Example Merchant",
    "imageUrl": "https://example.com/merchant.png"
  },
  "point": {
    "id": "cmiimp4g400015v01nv1ij7zf",
    "name": "LAT",
    "symbol": "LAT",
    "merchantId": "cmih1s6qu00050i01m3cactjj",
    "imageUrl": "https://example.com/point.png",
    "balance": 100
  },
  "sender": {
    "id": "cmih1s6qu00050i01m3cactjj",
    "walletAddress": "0x50581102bEB5cDEb68cB5f84ACdE46fa2DeB842E",
    "emailOrWebsite": "https://example.com"
  },
  "receiver": {
    "id": "cmiisvgqn0007xk01efv8szbq",
    "walletAddress": "0x60581102bEB5cDEb68cB5f84ACdE46fa2DeB843F",
    "emailOrWebsite": "customer@example.com"
  },
  "voucher": null,
  "eventId": null,
  "transactionRefId": null,
  "typeAsset": "POINT",
  "createdAt": "2025-01-01T00:00:00.000Z"
}
```

#### Error Response (404)

```json
{
  "statusCode": 404,
  "message": "Transaction with id cm4abc123xyz not found"
}
```

---

## 15. Clear Customer by Phone

**Description:** ลบข้อมูลลูกค้าทั้งหมดโดยใช้เบอร์โทรศัพท์ (ลบ wallet, transactions, temp links, clear voucher ownership)

### Request

**Method:** `DELETE`

**URL:** `{{endpoint_url}}/customer/:phone`

**Example:** `https://dlp-backofficebe-testnet.adldigitalservice.com/customer/0984360421`

**Authentication:** Public (ไม่ต้องใช้ API Key)

### Request Parameters

#### Path Parameters

| Parameter | Type | M/O | Description | Example |
|-----------|------|-----|-------------|---------|
| phone | String | M | เบอร์โทรศัพท์ของลูกค้า (10 digits) | 0984360421 |

### Response

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| success | Boolean | สถานะการลบ |
| message | String | ข้อความสถานะ |
| phone | String | เบอร์โทรศัพท์ที่ลบ |
| customerId | String | รหัสลูกค้าที่ถูกลบ |

#### Success Response (200)

```json
{
  "success": true,
  "message": "Customer cleared successfully",
  "phone": "0984360421",
  "customerId": "cmiisvgqn0007xk01efv8szbq"
}
```

#### Error Response (404)

```json
{
  "statusCode": 404,
  "message": "Customer not found"
}
```

#### Error Response (500)

```json
{
  "statusCode": 500,
  "message": "Internal server error"
}
```

### Notes

- การลบจะดำเนินการใน transaction เพื่อความ atomicity
- ข้อมูลที่ถูกลบ:
  - Voucher ownership (set currentOwnerId เป็น null)
  - Customer record (cascade ไปยัง CustomerMerChant, CustomerPoint, Transactions)
  - Wallet record
  - Temp links ที่เกี่ยวข้อง

---

## 16. Get Voucher by ID

**Description:** ดึงข้อมูล Voucher ด้วย ID พร้อม merchant info และ voucher codes

### Request

**Method:** `GET`

**URL:** `{{endpoint_url}}/coupon/:voucherId`

**Example:** `https://dlp-backofficebe-testnet.adldigitalservice.com/coupon/cm123abc456`

**Authentication:** Public (ไม่ต้องใช้ API Key)

### Request Parameters

#### Path Parameters

| Parameter | Type | M/O | Description | Example |
|-----------|------|-----|-------------|---------|
| voucherId | String | M | รหัส Voucher | cm123abc456 |

### Response

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| id | String | รหัส Voucher |
| name | String | ชื่อ Voucher |
| description | String \| null | คำอธิบาย |
| imageUrl | String \| null | URL รูปภาพ |
| status | String | สถานะ: `active`, `inactive`, `upcoming`, `expired` |
| valueType | String | ประเภทมูลค่า: `percentage`, `cash`, `gift`, `multiplier`, `aispoint` |
| value | Number | มูลค่า |
| currency | String \| null | สกุลเงิน |
| startDate | String \| null | วันเริ่มต้น |
| endDate | String \| null | วันหมดอายุ |
| tokenId | String \| null | Token ID บน blockchain |
| totalRedeemed | Number | จำนวนที่ใช้แล้ว |
| merchantId | String \| null | รหัส Merchant |
| merchantName | String \| null | ชื่อ Merchant |
| merchantRef | String \| null | Reference ID จาก merchant |
| createdAt | String | วันที่สร้าง |
| updatedAt | String | วันที่อัพเดต |
| merchant | Object \| null | ข้อมูล Merchant |
| merchant.id | String | รหัส Merchant |
| merchant.name | String | ชื่อ Merchant |
| merchant.description | String \| null | คำอธิบาย |
| merchant.imageUrl | String \| null | URL รูปภาพ |
| merchant.website | String \| null | Website |
| voucherCodes | Array | รายการ Voucher Codes |
| voucherCodes[].id | String | รหัส Voucher Code |
| voucherCodes[].code | String | Code |
| voucherCodes[].pointsCost | Number | ราคา (points) |
| voucherCodes[].currency | String \| null | สกุลเงินของ point |
| voucherCodes[].isUsed | Boolean | ใช้แล้วหรือยัง |
| voucherCodes[].usedAt | String \| null | วันที่ใช้ |
| voucherCodes[].usedBy | String \| null | ใช้โดยใคร |
| voucherCodes[].currentOwnerId | String \| null | รหัสเจ้าของปัจจุบัน |
| voucherCodes[].createdAt | String | วันที่สร้าง |

#### Success Response (200)

```json
{
  "id": "cm123abc456",
  "name": "Discount 10%",
  "description": "Get 10% off on your next purchase",
  "imageUrl": "https://example.com/voucher.png",
  "status": "active",
  "valueType": "percentage",
  "value": 10,
  "currency": "THB",
  "startDate": "2025-01-01T00:00:00.000Z",
  "endDate": "2026-01-01T00:00:00.000Z",
  "tokenId": "1",
  "totalRedeemed": 5,
  "merchantId": "cmih1s6qu00050i01m3cactjj",
  "merchantName": "Example Merchant",
  "merchantRef": "VOUCHER-001",
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-01T00:00:00.000Z",
  "merchant": {
    "id": "cmih1s6qu00050i01m3cactjj",
    "name": "Example Merchant",
    "description": "A sample merchant",
    "imageUrl": "https://example.com/merchant.png",
    "website": "https://example.com"
  },
  "voucherCodes": [
    {
      "id": "cmxyz789",
      "code": "DISC10-001",
      "pointsCost": 100,
      "currency": "LAT",
      "isUsed": false,
      "usedAt": null,
      "usedBy": null,
      "currentOwnerId": "cmiisvgqn0007xk01efv8szbq",
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  ]
}
```

#### Error Response (404)

```json
{
  "statusCode": 404,
  "message": "Voucher with id cm123abc456 not found"
}
```

---

## 17. Get Customer Owned Vouchers

**Description:** ดึงรายการ Vouchers ที่ลูกค้าเป็นเจ้าของ (lookup จาก phone -> wallet -> on-chain balance)

### Request

**Method:** `GET`

**URL:** `{{endpoint_url}}/coupon/my-coupons/:phone`

**Example:** `https://dlp-backofficebe-testnet.adldigitalservice.com/coupon/my-coupons/0984360421?status=all&page=1&limit=20`

**Authentication:** Public (ไม่ต้องใช้ API Key)

### Request Parameters

#### Path Parameters

| Parameter | Type | M/O | Description | Example |
|-----------|------|-----|-------------|---------|
| phone | String | M | เบอร์โทรศัพท์ลูกค้า (10 digits) | 0984360421 |

#### Query Parameters

| Parameter | Type | M/O | Description | Default |
|-----------|------|-----|-------------|---------|
| status | String | O | Filter by status: `unused`, `used`, `all` | all |
| page | Number | O | หมายเลขหน้า | 1 |
| limit | Number | O | จำนวนรายการต่อหน้า | 20 |

### Response

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| phone | String | เบอร์โทรศัพท์ |
| walletAddress | String \| null | Wallet address |
| customerId | String \| null | รหัสลูกค้า |
| status | String | Status filter ที่ใช้ |
| pagination | Object | ข้อมูล pagination |
| pagination.page | Number | หน้าปัจจุบัน |
| pagination.limit | Number | จำนวนต่อหน้า |
| pagination.total | Number | จำนวนทั้งหมด |
| pagination.totalPages | Number | จำนวนหน้าทั้งหมด |
| summary | Object | สรุปจำนวน |
| summary.total | Number | จำนวน vouchers ทั้งหมด |
| summary.unused | Number | จำนวนที่ยังไม่ได้ใช้ |
| summary.used | Number | จำนวนที่ใช้แล้ว |
| vouchers | Array | รายการ vouchers |
| vouchers[].codeId | String \| null | รหัส Voucher Code |
| vouchers[].code | String \| null | Code |
| vouchers[].isUsed | Boolean | ใช้แล้วหรือยัง |
| vouchers[].usedAt | String \| null | วันที่ใช้ |
| vouchers[].pointsCost | Number | ราคา (points) |
| vouchers[].currency | String | สกุลเงินของ point |
| vouchers[].purchasedAt | String \| null | วันที่ซื้อ |
| vouchers[].purchaseType | String | ประเภทการซื้อ |
| vouchers[].onChainBalance | String | ยอดบน blockchain |
| vouchers[].voucher | Object | ข้อมูล voucher |
| vouchers[].voucher.id | String | รหัส Voucher |
| vouchers[].voucher.tokenId | String \| null | Token ID |
| vouchers[].voucher.name | String | ชื่อ Voucher |
| vouchers[].voucher.description | String \| null | คำอธิบาย |
| vouchers[].voucher.valueType | String | ประเภทมูลค่า |
| vouchers[].voucher.value | Number | มูลค่า |
| vouchers[].voucher.currency | String \| null | สกุลเงิน |
| vouchers[].voucher.imageUrl | String \| null | URL รูปภาพ |
| vouchers[].voucher.startDate | String \| null | วันเริ่มต้น |
| vouchers[].voucher.endDate | String \| null | วันหมดอายุ |
| vouchers[].voucher.merchantRef | String \| null | Reference ID |
| vouchers[].merchant | Object | ข้อมูล Merchant |
| vouchers[].merchant.id | String | รหัส Merchant |
| vouchers[].merchant.name | String | ชื่อ Merchant |
| vouchers[].merchant.imageUrl | String \| null | URL รูป Merchant |

#### Success Response (200)

```json
{
  "phone": "0984360421",
  "walletAddress": "0x50581102bEB5cDEb68cB5f84ACdE46fa2DeB842E",
  "customerId": "cmiisvgqn0007xk01efv8szbq",
  "status": "all",
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 3,
    "totalPages": 1
  },
  "summary": {
    "total": 3,
    "unused": 2,
    "used": 1
  },
  "vouchers": [
    {
      "codeId": "cmxyz789",
      "code": "DISC10-001",
      "isUsed": false,
      "usedAt": null,
      "pointsCost": 100,
      "currency": "LAT",
      "purchasedAt": "2025-01-15T10:30:00.000Z",
      "purchaseType": "TRANSFER",
      "transactionRefId": "550e8400-e29b-41d4-a716-446655440000",
      "onChainBalance": "1",
      "voucher": {
        "id": "cm123abc456",
        "tokenId": "1",
        "name": "Discount 10%",
        "description": "Get 10% off on your next purchase",
        "valueType": "percentage",
        "value": 10,
        "currency": "THB",
        "imageUrl": "https://example.com/voucher.png",
        "startDate": "2025-01-01T00:00:00.000Z",
        "endDate": "2026-01-01T00:00:00.000Z",
        "merchantRef": "VOUCHER-001"
      },
      "merchant": {
        "id": "cmih1s6qu00050i01m3cactjj",
        "name": "Example Merchant",
        "imageUrl": "https://example.com/merchant.png"
      }
    }
  ]
}
```

#### Response when customer not found (200)

```json
{
  "phone": "0984360421",
  "walletAddress": null,
  "customerId": null,
  "status": "all",
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 0
  },
  "summary": {
    "total": 0,
    "unused": 0,
    "used": 0
  },
  "vouchers": []
}
```

### Notes

- Endpoint นี้จะ query on-chain balance จาก blockchain ด้วย
- `onChainBalance` แสดงจำนวน NFT ที่เหลือบน blockchain
- รวม voucher ที่ซื้อแล้วและที่ redeem แล้ว (isUsed = true)
- Pagination ทำงานหลังจาก filter status

---

## 18. Get Seller Marketplace Listings

**Description:** ดึงรายการ voucher ที่ seller ขายบน marketplace (สำหรับ merchant ซื้อ) - กรอง listings ที่ใช้ THB เป็น payment token

### Request

**Method:** `GET`

**URL:** `{{endpoint_url}}/coupon/merchant/seller-listings`

**Example:** `https://dlp-backofficebe-testnet.adldigitalservice.com/coupon/merchant/seller-listings?page=1&limit=10`

### Request Parameters

#### Query Parameters

| Parameter | Type | M/O | Description | Default |
|-----------|------|-----|-------------|---------|
| page | Number | O | หมายเลขหน้า | 1 |
| limit | Number | O | จำนวนรายการต่อหน้า | 20 |

### Response

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| listings | Array | รายการ listings จาก blockchain marketplace |
| listings[].listingId | String | รหัส listing บน marketplace |
| listings[].seller | String | Wallet address ของ seller |
| listings[].typeId | String | Token ID ของ coupon (ERC-1155) |
| listings[].amount | String | จำนวน coupon ที่เหลือใน listing |
| listings[].pricePerUnit | String | ราคาต่อหน่วย (THB) |
| listings[].paymentToken | String | Contract address ของ THB token |
| listings[].isActive | Boolean | สถานะ listing |
| listings[].listedAt | Number | Unix timestamp ที่ list |
| listings[].voucher | Object \| null | ข้อมูล voucher จาก database (ถ้ามี) |
| listings[].voucher.id | String | รหัส voucher |
| listings[].voucher.name | String | ชื่อ voucher |
| listings[].voucher.description | String | รายละเอียด |
| listings[].voucher.imageUrl | String | URL รูปภาพ |
| listings[].voucher.valueType | String | ประเภทมูลค่า |
| listings[].voucher.value | Number | มูลค่า |
| pagination | Object | ข้อมูล pagination |
| pagination.page | Number | หน้าปัจจุบัน |
| pagination.limit | Number | จำนวนต่อหน้า |
| pagination.total | Number | จำนวนทั้งหมด |
| pagination.totalPages | Number | จำนวนหน้าทั้งหมด |

#### Success Response (200)

```json
{
  "listings": [
    {
      "listingId": "5",
      "seller": "0xaa18f00e63efea1de8b18308bf74b740811b3c0f",
      "typeId": "10",
      "amount": "50",
      "pricePerUnit": "100.0",
      "paymentToken": "0x1234567890abcdef1234567890abcdef12345678",
      "isActive": true,
      "listedAt": 1735084800,
      "voucher": {
        "id": "cm123abc456",
        "name": "Starbucks Gift Card 100 THB",
        "description": "Redeem for any Starbucks drink",
        "imageUrl": "https://example.com/starbucks.png",
        "valueType": "cash",
        "value": 100,
        "merchant": null
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

### Response Status Codes

| HTTP Status | Status Code | Description |
|-------------|-------------|-------------|
| 200 | 200 | Success - Seller listings retrieved |
| 500 | 500 | Internal Server Error |

### Notes

- Endpoint นี้กรองเฉพาะ listings ที่มี payment token เป็น THB (seller -> merchant flow)
- listings สำหรับ customer (Point token) จะไม่แสดงใน endpoint นี้
- ข้อมูล voucher จะ null ถ้าไม่พบใน database (listing ยังไม่ sync)

---

## 19. Seller List Voucher on Marketplace

**Description:** Seller ลง voucher ขายบน marketplace โดยใช้ THB เป็น payment token

### Request

**Method:** `POST`

**URL:** `{{endpoint_url}}/coupon/seller/list-on-marketplace`

**Example:** `https://dlp-backofficebe-testnet.adldigitalservice.com/coupon/seller/list-on-marketplace`


### Request Parameters

#### Request Body

| Parameter | Type | M/O | Description | Example |
|-----------|------|-----|-------------|---------|
| voucherId | String | M | รหัส voucher ที่ต้องการขาย | cm123abc456 |
| amount | Number | M | จำนวน voucher ที่ต้องการขาย | 100 |
| pricePerUnitTHB | Number | M | ราคาต่อหน่วย (THB) | 50 |
| sellerWalletAddress | String | M | Wallet address ของ seller | 0xaa18f00e63efea1de8b18308bf74b740811b3c0f |

**Example Request Body:**
```json
{
  "voucherId": "cm123abc456",
  "amount": 100,
  "pricePerUnitTHB": 50,
  "sellerWalletAddress": "0xaa18f00e63efea1de8b18308bf74b740811b3c0f"
}
```

### Response

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| listing | Object | ข้อมูล listing ที่สร้าง |
| listing.voucherId | String | รหัส voucher |
| listing.voucherName | String | ชื่อ voucher |
| listing.listingId | String | รหัส listing บน marketplace |
| listing.tokenId | String | Token ID ของ coupon (ERC-1155) |
| listing.amount | Number | จำนวนที่ list |
| listing.pricePerUnitTHB | Number | ราคาต่อหน่วย (THB) |
| listing.totalPriceTHB | Number | ราคารวม (THB) |
| listing.paymentToken | String | Contract address ของ THB token |
| listing.seller | String | Wallet address ของ seller |
| blockchain | Object | ข้อมูล blockchain transaction |
| blockchain.transactionHash | String | Transaction hash |
| blockchain.blockNumber | Number | Block number |
| nextSteps | Object | คำแนะนำขั้นตอนถัดไป |

#### Success Response (200)

```json
{
  "listing": {
    "voucherId": "cm123abc456",
    "voucherName": "Starbucks Gift Card",
    "listingId": "5",
    "tokenId": "10",
    "amount": 100,
    "pricePerUnitTHB": 50,
    "totalPriceTHB": 5000,
    "paymentToken": "0x1234567890abcdef1234567890abcdef12345678",
    "seller": "0xaa18f00e63efea1de8b18308bf74b740811b3c0f"
  },
  "blockchain": {
    "transactionHash": "0xabc123...",
    "blockNumber": 12345678
  },
  "nextSteps": {
    "message": "Vouchers are now listed on marketplace. Merchants can purchase using the listingId.",
    "merchantEndpoint": "POST /coupon/merchant/buy-from-seller",
    "requiredData": {
      "listingId": "5",
      "amount": "number of vouchers to buy",
      "merchantId": "merchant ID"
    }
  }
}
```

#### Error Responses

**Voucher Not Found (404)**
```json
{
  "statusCode": 404,
  "message": "Voucher cm123abc456 not found"
}
```

**Voucher Already Assigned (400)**
```json
{
  "statusCode": 400,
  "message": "This voucher is already assigned to a merchant. Only unassigned vouchers can be listed by sellers."
}
```

**No TokenId (400)**
```json
{
  "statusCode": 400,
  "message": "Voucher must have a tokenId. Please mint the NFT first."
}
```

### Response Status Codes

| HTTP Status | Status Code | Description |
|-------------|-------------|-------------|
| 200 | 200 | Success - Voucher listed on marketplace |
| 400 | 400 | Bad Request - Invalid data or voucher already assigned |
| 404 | 404 | Not Found - Voucher not found |
| 500 | 500 | Internal Server Error |

### Notes

- Seller ต้องมี wallet ที่ลงทะเบียนในระบบและมี private key
- Voucher ที่ list ต้องยังไม่ถูก assign ให้ merchant (merchantId = null)
- ระบบจะ auto-whitelist seller บน marketplace ถ้ายังไม่ได้ whitelist
- ระบบจะ mint NFT ไปยัง seller wallet ก่อน list

---

## 20. Merchant Buy Voucher from Seller

**Description:** Merchant ซื้อ voucher จาก seller บน marketplace โดยใช้ THB token

### Request

**Method:** `POST`

**URL:** `{{endpoint_url}}/coupon/merchant/buy-from-seller`

**Example:** `https://dlp-backofficebe-testnet.adldigitalservice.com/coupon/merchant/buy-from-seller`

**Authentication:** Public (ไม่ต้องใช้ API Key)

### Request Parameters

#### Request Body

| Parameter | Type | M/O | Description | Example |
|-----------|------|-----|-------------|---------|
| listingId | String | M | รหัส listing บน marketplace | 5 |
| amount | Number | M | จำนวน voucher ที่ต้องการซื้อ | 10 |
| merchantId | String | M | รหัส merchant | cmih1s6qu00050i01m3cactjj |

**Example Request Body:**
```json
{
  "listingId": "5",
  "amount": 10,
  "merchantId": "cmih1s6qu00050i01m3cactjj"
}
```

### Response

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| purchase | Object | ข้อมูลการซื้อ |
| purchase.listingId | String | รหัส listing |
| purchase.amount | Number | จำนวนที่ซื้อ |
| purchase.merchantId | String | รหัส merchant |
| purchase.merchantName | String | ชื่อ merchant |
| purchase.tokenId | String | Token ID ของ coupon |
| purchase.totalPriceWei | String | ราคารวม (Wei) |
| purchase.totalPriceTHB | String | ราคารวม (THB) |
| purchase.transactionId | String | รหัส transaction ในระบบ |
| purchase.purchasedAt | String | วันที่ซื้อ |
| blockchain | Object | ข้อมูล blockchain transaction |
| blockchain.transactionHash | String | Transaction hash |
| blockchain.blockNumber | Number | Block number |
| blockchain.seller | String | Wallet address ของ seller |
| blockchain.paymentToken | String | Contract address ของ THB token |
| nextSteps | Object | คำแนะนำขั้นตอนถัดไป |

#### Success Response (200)

```json
{
  "purchase": {
    "listingId": "5",
    "amount": 10,
    "merchantId": "cmih1s6qu00050i01m3cactjj",
    "merchantName": "AIS Shop",
    "tokenId": "10",
    "totalPriceWei": "500000000000000000000",
    "totalPriceTHB": "500.0",
    "transactionId": "cm4abc123xyz",
    "purchasedAt": "2025-12-25T10:30:00.000Z"
  },
  "blockchain": {
    "transactionHash": "0xdef456...",
    "blockNumber": 12345679,
    "seller": "0xaa18f00e63efea1de8b18308bf74b740811b3c0f",
    "paymentToken": "0x1234567890abcdef1234567890abcdef12345678"
  },
  "nextSteps": {
    "message": "Coupons purchased successfully. Next, activate the voucher batch to list them for customers using Point tokens.",
    "actionRequired": "Call activateVoucher endpoint to list for customers"
  }
}
```

#### Error Responses

**Merchant Not Found (404)**
```json
{
  "statusCode": 404,
  "message": "Merchant cmih1s6qu00050i01m3cactjj not found"
}
```

**Listing Not Active (400)**
```json
{
  "statusCode": 400,
  "message": "Listing is not active"
}
```

**Not THB Listing (400)**
```json
{
  "statusCode": 400,
  "message": "This listing is not a seller listing. Sellers must use THB token as payment."
}
```

### Response Status Codes

| HTTP Status | Status Code | Description |
|-------------|-------------|-------------|
| 200 | 200 | Success - Voucher purchased |
| 400 | 400 | Bad Request - Invalid listing or insufficient balance |
| 404 | 404 | Not Found - Merchant or listing not found |
| 500 | 500 | Internal Server Error |

### Notes

- **⚠️ PHASE 1 FEATURE:** ระบบจะ auto-mint THB token ให้ merchant หาก balance ไม่พอ
- ใน Phase 2+ จะต้อง deposit เงินจริงก่อนซื้อ
- Voucher จะถูก assign ให้ merchant และเปลี่ยน status เป็น "upcoming"
- Merchant ต้อง activate voucher เพื่อขายให้ customer ต่อ

---

## 21. Customer Buy Voucher from Marketplace

**Description:** Customer ซื้อ voucher จาก marketplace โดยใช้ Point token

### Request

**Method:** `POST`

**URL:** `{{endpoint_url}}/coupon/marketplace/buy`

**Example:** `https://dlp-backofficebe-testnet.adldigitalservice.com/coupon/marketplace/buy`

**Authentication:** Public (ไม่ต้องใช้ API Key)

### Request Parameters

#### Request Body

| Parameter | Type | M/O | Description | Example |
|-----------|------|-----|-------------|---------|
| voucherGroupId | String | M | รหัส listing/group บน marketplace | 5 |
| pointId | String | M | รหัส point ที่ใช้จ่าย | cmiimp4g400015v01nv1ij7zf |
| phone | String | M | เบอร์โทรศัพท์ของ customer | 0984360421 |

**Example Request Body:**
```json
{
  "voucherGroupId": "5",
  "pointId": "cmiimp4g400015v01nv1ij7zf",
  "phone": "0984360421"
}
```

### Response

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| success | Boolean | สถานะความสำเร็จ |
| message | String | ข้อความสถานะ |
| purchase | Object | ข้อมูลการซื้อ |
| purchase.voucherCodeId | String | รหัส voucher code ที่ได้รับ |
| purchase.code | String | Code สำหรับใช้งาน |
| purchase.pointsSpent | Number | จำนวน point ที่ใช้ |
| purchase.currency | String | สกุล point |
| voucher | Object | ข้อมูล voucher |
| blockchain | Object | ข้อมูล blockchain transaction |
| transactions | Object | รหัส transactions ในระบบ |
| transactions.purchaseTransactionId | String | Transaction ID สำหรับ point deduction |
| transactions.voucherTransferTransactionId | String | Transaction ID สำหรับ voucher transfer |

#### Success Response (200)

```json
{
  "success": true,
  "message": "Voucher purchased successfully",
  "purchase": {
    "voucherCodeId": "cm4code123",
    "code": "STARBUCKS-001",
    "pointsSpent": 100,
    "currency": "LAT"
  },
  "voucher": {
    "id": "cm123abc456",
    "name": "Starbucks Gift Card 100 THB",
    "valueType": "cash",
    "value": 100,
    "merchant": {
      "id": "cmih1s6qu00050i01m3cactjj",
      "name": "AIS Shop"
    }
  },
  "blockchain": {
    "pointTransferHash": "0xabc123...",
    "nftTransferHash": "0xdef456...",
    "blockNumber": 12345680
  },
  "transactions": {
    "purchaseTransactionId": "cm4txn1",
    "voucherTransferTransactionId": "cm4txn2"
  }
}
```

#### Error Responses

**Customer Not Found (404)**
```json
{
  "statusCode": 404,
  "message": "Customer with phone 0984360421 not found"
}
```

**No Available Voucher (404)**
```json
{
  "statusCode": 404,
  "message": "No available voucher in group 5 that accepts point cmiimp4g400015v01nv1ij7zf"
}
```

**Insufficient Balance (400)**
```json
{
  "statusCode": 400,
  "message": "Insufficient LAT balance. Required: 100, Available: 50"
}
```

**Voucher Expired (400)**
```json
{
  "statusCode": 400,
  "message": "Voucher has expired on 2025-12-24T23:59:59.000Z"
}
```

### Response Status Codes

| HTTP Status | Status Code | Description |
|-------------|-------------|-------------|
| 200 | 200 | Success - Voucher purchased |
| 400 | 400 | Bad Request - Insufficient balance, expired, or not yet valid |
| 404 | 404 | Not Found - Customer or voucher not found |
| 500 | 500 | Internal Server Error |

### Notes

- Customer ต้องมี point balance เพียงพอ
- ระบบจะสร้าง 2 transactions: TRANSFER (type: POINT, point deduction) และ VOUCHER_TRANSFER (type: VOUCHER, NFT transfer)
- ทั้ง 2 transactions จะ link กันด้วย `transactionRefId` (UUID)
- Voucher code จะถูก assign ให้ customer (currentOwnerId)
- ใช้ transactionRefId เดียวกันสำหรับทั้ง 2 transactions

---

## 22. Get Treasury Balance

**Description:** ดึงยอดคงเหลือของ treasury wallet สำหรับ point

### Request

**Method:** `GET`

**URL:** `{{endpoint_url}}/treasury/:treasuryType/:pointId/balance`

**Example:** `https://dlp-backofficebe-testnet.adldigitalservice.com/treasury/MERCHANT/cmiimp4g400015v01nv1ij7zf/balance`

**Authentication:** Public (ไม่ต้องใช้ API Key)

### Request Parameters

#### Path Parameters

| Parameter | Type | M/O | Description | Example |
|-----------|------|-----|-------------|---------|
| treasuryType | String | M | ประเภท treasury (MERCHANT, CUSTOMER, etc.) | MERCHANT |
| pointId | String | M | รหัส point | cmiimp4g400015v01nv1ij7zf |

### Response

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| walletAddress | String | Wallet address ของ treasury |
| pointId | String | รหัส point |
| balance | String | ยอดคงเหลือ |
| treasuryType | String | ประเภท treasury |

#### Success Response (200)

```json
{
  "walletAddress": "0x1234567890abcdef1234567890abcdef12345678",
  "pointId": "cmiimp4g400015v01nv1ij7zf",
  "balance": "50000.0",
  "treasuryType": "MERCHANT"
}
```

#### Error Response (404)

```json
{
  "statusCode": 404,
  "message": "Treasury with type 'UNKNOWN' not found"
}
```

### Response Status Codes

| HTTP Status | Status Code | Description |
|-------------|-------------|-------------|
| 200 | 200 | Success - Balance retrieved |
| 404 | 404 | Not Found - Treasury or Point not found |
| 500 | 500 | Internal Server Error |

---

## 23. Get Wallet by Phone or Email

**Description:** ค้นหา wallet ด้วยเบอร์โทรศัพท์หรืออีเมล (รองรับ THB balance check)

### Request

**Method:** `GET`

**URL:** `{{endpoint_url}}/wallet/search`

**Example:** `https://dlp-backofficebe-testnet.adldigitalservice.com/wallet/search?phone=0984360421`

**Authentication:** Public (ไม่ต้องใช้ API Key)

### Request Parameters

#### Query Parameters

| Parameter | Type | M/O | Description | Example |
|-----------|------|-----|-------------|---------|
| phone | String | O* | เบอร์โทรศัพท์ (ต้องระบุอย่างน้อย 1 อย่าง) | 0984360421 |
| email | String | O* | อีเมล (ต้องระบุอย่างน้อย 1 อย่าง) | seller@example.com |

*ต้องระบุอย่างน้อย phone หรือ email

### Response

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| id | String | รหัส wallet |
| walletAddress | String | Wallet address |
| email | String \| null | อีเมล |
| phoneNumber | String \| null | เบอร์โทรศัพท์ |
| type | String | ประเภท wallet (customer, merchant, seller) |
| status | String | สถานะ wallet (active, inactive) |
| thbBalance | Object | ยอด THB token (ถ้ามี) |
| thbBalance.balance | String | ยอดคงเหลือ (THB) |
| thbBalance.balanceWei | String | ยอดคงเหลือ (Wei) |

#### Success Response (200)

```json
{
  "id": "cmwallet123",
  "walletAddress": "0xaa18f00e63efea1de8b18308bf74b740811b3c0f",
  "email": "seller@example.com",
  "phoneNumber": null,
  "type": "seller",
  "status": "active",
  "thbBalance": {
    "address": "0xaa18f00e63efea1de8b18308bf74b740811b3c0f",
    "balance": "10000.0",
    "balanceWei": "10000000000000000000000"
  }
}
```

#### Error Responses

**Missing Parameters (400)**
```json
{
  "statusCode": 400,
  "message": "Please provide either phone number or email"
}
```

**Wallet Not Found (404)**
```json
{
  "statusCode": 404,
  "message": "Wallet not found"
}
```

### Response Status Codes

| HTTP Status | Status Code | Description |
|-------------|-------------|-------------|
| 200 | 200 | Success - Wallet found |
| 400 | 400 | Bad Request - Missing parameters |
| 404 | 404 | Not Found - Wallet not found |
| 500 | 500 | Internal Server Error |

### Notes

- ใช้สำหรับค้นหา wallet ของ seller เพื่อดู THB balance
- `thbBalance` จะ query จาก blockchain โดยตรง

---

## 24. Admin Mint THB to Merchant (Phase 1 Dev)

**Description:** ⚠️ **PHASE 1 DEVELOPMENT ONLY** - Admin mint THB token ให้ merchant wallet

### Request

**Method:** `POST`

**URL:** `{{endpoint_url}}/admin/mint-thb-to-merchant`

**Example:** `https://dlp-backofficebe-testnet.adldigitalservice.com/admin/mint-thb-to-merchant`

**Authentication:** ⚠️ Should be admin-only in production

### Request Parameters

#### Request Body

| Parameter | Type | M/O | Description | Example |
|-----------|------|-----|-------------|---------|
| merchantId | String | M | รหัส merchant ที่จะรับ THB | cmih1s6qu00050i01m3cactjj |
| amount | Number | M | จำนวน THB ที่จะ mint | 10000 |

**Example Request Body:**
```json
{
  "merchantId": "cmih1s6qu00050i01m3cactjj",
  "amount": 10000
}
```

### Response

#### Success Response (200)

```json
{
  "success": true,
  "message": "THB minted successfully",
  "merchantId": "cmih1s6qu00050i01m3cactjj",
  "merchantWallet": "0xf5e40ec8bfa4818278c04489b34a486281658e5c",
  "amountMinted": 10000,
  "transactionHash": "0xabc123...",
  "blockNumber": 12345678
}
```

### Response Status Codes

| HTTP Status | Status Code | Description |
|-------------|-------------|-------------|
| 200 | 200 | Success - THB minted |
| 404 | 404 | Not Found - Merchant not found |
| 500 | 500 | Internal Server Error |

### ⚠️ Security Warning

- **Endpoint นี้สำหรับ development/testing เท่านั้น**
- ใน production ต้อง:
  - ใช้ payment gateway จริง
  - ต้องมี admin authentication
  - ต้องมี rate limiting
  - ต้องมี audit trail

---

## 25. Seller Batch List on Marketplace

List หลาย voucher types บน marketplace ใน 1 batch

### Endpoint

`POST /coupon/seller/batch-list`

### Request Body

| Field | Type | M/O | Description |
|-------|------|-----|-------------|
| name | String | O | ชื่อ batch (e.g., "Christmas Sale Pack") |
| description | String | O | รายละเอียด batch |
| items | Array | M | Array ของ vouchers ที่ต้องการ list |
| items[].voucherId | String | M | Voucher ID |
| items[].amount | Number | M | จำนวนที่ต้องการ list |
| items[].pricePerUnitTHB | Number | M | ราคาต่อหน่วย (THB) |
| sellerWalletAddress | String | M | Wallet address ของ seller |

### Example Request

```json
{
  "name": "Christmas Sale Pack",
  "description": "Special holiday vouchers",
  "items": [
    {
      "voucherId": "voucher-a-id",
      "amount": 2,
      "pricePerUnitTHB": 100
    },
    {
      "voucherId": "voucher-b-id",
      "amount": 3,
      "pricePerUnitTHB": 50
    }
  ],
  "sellerWalletAddress": "0x1234567890abcdef..."
}
```

### Response

```json
{
  "batch": {
    "id": "clxxxxxxxxxx",
    "name": "Christmas Sale Pack",
    "description": "Special holiday vouchers",
    "sellerWalletAddress": "0x1234...",
    "totalItems": 5,
    "totalValue": 350,
    "currency": "THB",
    "status": "ACTIVE"
  },
  "items": [
    {
      "voucherId": "voucher-a-id",
      "voucherName": "คูปอง A",
      "tokenId": "1",
      "listingId": "listing-001",
      "amount": 2,
      "pricePerUnitTHB": 100,
      "txHash": "0xabc...",
      "blockNumber": 12345
    },
    {
      "voucherId": "voucher-b-id",
      "voucherName": "คูปอง B",
      "tokenId": "2",
      "listingId": "listing-002",
      "amount": 3,
      "pricePerUnitTHB": 50,
      "txHash": "0xdef...",
      "blockNumber": 12346
    }
  ],
  "nextSteps": {
    "message": "Successfully listed 5 vouchers in batch...",
    "viewListingsEndpoint": "GET /voucher/seller/listings/clxxxxxxxxxx",
    "merchantBuyEndpoint": "POST /voucher/merchant/buy-from-seller"
  }
}
```

---

## 26. Get Seller Listings

ดึง listing batches ทั้งหมดของ seller

### Endpoint

`GET /coupon/seller/listings`

### Query Parameters

| Field | Type | M/O | Description |
|-------|------|-----|-------------|
| walletAddress | String | M | Wallet address ของ seller |
| page | Number | O | หน้าที่ต้องการ (default: 1) |
| limit | Number | O | จำนวนต่อหน้า (default: 20) |
| status | String | O | Filter by status: ACTIVE, SOLD_OUT, CANCELLED, EXPIRED |

### Example Request

```
GET /coupon/seller/listings?walletAddress=0x1234...&page=1&limit=10&status=ACTIVE
```

### Response

```json
{
  "listings": [
    {
      "id": "clxxxxxxxxxx",
      "name": "Christmas Sale Pack",
      "description": "Special holiday vouchers",
      "sellerWalletAddress": "0x1234...",
      "totalItems": 5,
      "soldItems": 2,
      "remainingItems": 3,
      "totalValue": 350,
      "currency": "THB",
      "status": "ACTIVE",
      "createdAt": "2025-12-25T10:00:00Z",
      "voucherTypes": 2
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1
  }
}
```

---

## 27. Get Listing Batch Detail

ดูรายละเอียด batch และ vouchers ทั้งหมดในนั้น

### Endpoint

`GET /coupon/seller/listings/:batchId`

### Path Parameters

| Field | Type | Description |
|-------|------|-------------|
| batchId | String | Listing batch ID |

### Response

```json
{
  "id": "clxxxxxxxxxx",
  "name": "Christmas Sale Pack",
  "description": "Special holiday vouchers",
  "sellerWalletAddress": "0x1234...",
  "totalItems": 5,
  "soldItems": 2,
  "remainingItems": 3,
  "totalValue": 350,
  "currency": "THB",
  "status": "ACTIVE",
  "createdAt": "2025-12-25T10:00:00Z",
  "updatedAt": "2025-12-25T12:00:00Z",
  "voucherTypes": [
    {
      "voucherId": "voucher-a-id",
      "voucherName": "คูปอง A",
      "voucherGroupId": "listing-001",
      "tokenId": "1",
      "totalAmount": 2,
      "soldAmount": 1,
      "remainingAmount": 1,
      "pricePerUnit": 100,
      "currency": "THB"
    },
    {
      "voucherId": "voucher-b-id",
      "voucherName": "คูปอง B",
      "voucherGroupId": "listing-002",
      "tokenId": "2",
      "totalAmount": 3,
      "soldAmount": 1,
      "remainingAmount": 2,
      "pricePerUnit": 50,
      "currency": "THB"
    }
  ]
}
```

---

## Enums Reference

### ListingBatchStatus

สถานะของ Listing Batch ที่ seller สร้างขึ้น

| Status | Value | Description | Trigger |
|--------|-------|-------------|---------|
| **ACTIVE** | `ACTIVE` | Listing ยังเปิดขายอยู่ | Default เมื่อสร้าง batch ใหม่ |
| **SOLD_OUT** | `SOLD_OUT` | ขายหมดแล้ว | Auto-update เมื่อ `soldItems >= totalItems` |
| **CANCELLED** | `CANCELLED` | ถูกยกเลิกโดย seller | Manual update โดย seller |
| **EXPIRED** | `EXPIRED` | หมดอายุ | Manual/Cron job based on expiry date |

### VoucherStatus

สถานะของ Voucher

| Status | Value | Description |
|--------|-------|-------------|
| **active** | `active` | Voucher พร้อมใช้งาน อยู่ใน marketplace |
| **upcoming** | `upcoming` | Voucher ที่ยังไม่ถึงกำหนดเริ่มต้น หรือ merchant ซื้อจาก seller แล้วแต่ยังไม่ activate |

### VoucherValueType

ประเภทมูลค่าของ Voucher

| Type | Value | Description | Example |
|------|-------|-------------|---------|
| **percentage** | `percentage` | ส่วนลดเป็นเปอร์เซ็นต์ | 10% off |
| **cash** | `cash` | ส่วนลดเป็นเงิน | 100 THB off |
| **gift** | `gift` | ของแถมฟรี | Free item |
| **multiplier** | `multiplier` | ตัวคูณ point | 2x points |
| **aispoint** | `aispoint` | แลก AIS Point | AIS Point redemption |

### AssetType

ประเภท asset ในธุรกรรม

| Type | Value | Description | Transaction Types |
|------|-------|-------------|-------------------|
| **POINT** | `POINT` | ธุรกรรมเกี่ยวกับ Point token | TRANSFER, MINT, BURN, EARN |
| **VOUCHER** | `VOUCHER` | ธุรกรรมเกี่ยวกับ Voucher/Coupon | VOUCHER_TRANSFER, REDEEM, MERCHANT_PURCHASE_FROM_SELLER |

### TransactionTypeId

ประเภทธุรกรรมทั้งหมดในระบบ

| Type ID | Description | Direction | Asset Type |
|---------|-------------|-----------|------------|
| **TRANSFER** | โอน Point แบบ B2C/C2C | OUTGOING/INCOMING | POINT |
| **MINT** | สร้าง Point ใหม่ | INCOMING | POINT |
| **BURN** | ทำลาย Point | OUTGOING | POINT |
| **EARN** | ได้รับ Point จากการซื้อสินค้า | INCOMING | POINT |
| **REDEEM** | ใช้งาน Voucher | - | VOUCHER |
| **VOUCHER_TRANSFER** | โอน Voucher ให้ customer | INCOMING | VOUCHER |
| **MERCHANT_PURCHASE_FROM_SELLER** | Merchant ซื้อ voucher จาก seller | - | VOUCHER |
| **VOUCHER_GIFT** | ให้ Voucher เป็นของขวัญ | OUTGOING/INCOMING | VOUCHER |

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
