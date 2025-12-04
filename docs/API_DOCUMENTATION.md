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
| data.ownedVouchers | Array | รายการ voucher ที่ลูกค้าเป็นเจ้าของ |
| data.ownedVouchers[].code | String | รหัส voucher code |
| data.ownedVouchers[].isUsed | Boolean | สถานะการใช้งาน |
| data.ownedVouchers[].voucher | Object | ข้อมูล voucher |

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
        "id": "mock-voucher-1",
        "code": "WELCOME2024",
        "voucherId": "voucher-mock-1",
        "pointsCost": 100,
        "currency": "POINTS",
        "isUsed": false,
        "usedAt": null,
        "voucher": {
          "id": "voucher-mock-1",
          "name": "Welcome Discount 20%",
          "description": "Get 20% off on your first purchase",
          "imageUrl": "https://via.placeholder.com/300x200?text=Welcome+Discount",
          "value": 20,
          "valueType": "percentage",
          "status": "active",
          "startDate": "2025-11-28T11:50:32.760Z",
          "endDate": "2025-12-28T11:50:32.760Z"
        }
      },
      {
        "id": "mock-voucher-2",
        "code": "FREESHIP50",
        "voucherId": "voucher-mock-2",
        "pointsCost": 50,
        "currency": "POINTS",
        "isUsed": false,
        "usedAt": null,
        "voucher": {
          "id": "voucher-mock-2",
          "name": "Free Shipping",
          "description": "Free shipping on orders over $50",
          "imageUrl": "https://via.placeholder.com/300x200?text=Free+Shipping",
          "value": 0,
          "valueType": "gift",
          "status": "active",
          "startDate": "2025-11-28T11:50:32.760Z",
          "endDate": "2026-01-27T11:50:32.760Z"
        }
      }
    ],
    "phone": "0984360421",
    "walletAddress": "0x50581102bEB5cDEb68cB5f84ACdE46fa2DeB842E"
  }
}
```

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

## 3. Get Transaction History by Customer

**Description:** ดึงประวัติธุรกรรมของลูกค้าในร้านค้านั้นๆด้วยเบอร์โทรศัพท์

### Request

**Method:** `GET`

**URL:** `{{endpoint_url}}/:merchantId/transaction/customer/:phone`

**Example:** `https://dlp-backofficebe-testnet.adldigitalservice.com/cmih1s6qu00050i01m3cactjj/transaction/customer/0984360421`

### Request Parameters

#### Header Fields

| Parameter | Type | M/O | Description | Example |
|-----------|------|-----|-------------|---------|
| x-api-key | String | M | API Key สำหรับ authentication | LEk8YLySHJdMD_nD0cw5 |

#### Path Parameters

| Parameter | Type | M/O | Description | Example |
|-----------|------|-----|-------------|---------|
| merchantId | String | M | รหัสร้านค้า | cmih1s6qu00050i01m3cactjj |
| phone | String | M | เบอร์โทรศัพท์ของลูกค้า | 0984360421 |

### Response

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

## 4. Get All Customer Transaction History

**Description:** ดึงประวัติธุรกรรมทั้งหมดของลูกค้าจากทุก merchants ด้วยเบอร์โทรศัพท์

### Request

**Method:** `GET`

**URL:** `{{endpoint_url}}/transaction/customer/:phone`

**Example:** `https://dlp-backofficebe-testnet.adldigitalservice.com/transaction/customer/0984360421`

### Request Parameters

#### Path Parameters

| Parameter | Type | M/O | Description | Example |
|-----------|------|-----|-------------|---------|
| phone | String | M | เบอร์โทรศัพท์ของลูกค้า | 0984360421 |

### Response

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| transactions | Array | รายการธุรกรรมทั้งหมดจากทุก merchants |
| transactions[].id | String | รหัสธุรกรรม |
| transactions[].txHash | String | Transaction hash บน blockchain |
| transactions[].senderAddress | String | Wallet address ของผู้ส่ง |
| transactions[].receiverAddress | String | Wallet address ของผู้รับ |
| transactions[].transactionTypeId | String | ประเภทธุรกรรม (TRANSFER, MINT, BURN, etc.) |
| transactions[].amount | Number | จำนวนคะแนนที่โอน |
| transactions[].merchantId | String | รหัสร้านค้า |
| transactions[].merchantName | String \| null | ชื่อร้านค้า |
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
      "merchantId": "cmih1s6qu00050i01m3cactjj",
      "merchantName": "Test Merchant A",
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
    },
    {
      "id": "abc123def456ghi789",
      "txHash": "0xabc123def456ghi789abc123def456ghi789abc123def456ghi789abc123def456",
      "senderAddress": "0x50581102beb5cdeb68cb5f84acde46fa2deb842e",
      "receiverAddress": "0x9876543210fedcba9876543210fedcba98765432",
      "transactionTypeId": "TRANSFER",
      "amount": 5,
      "merchantId": "xyz987merchant123",
      "merchantName": "Another Merchant B",
      "point": {
        "id": "point123xyz",
        "name": "GOLD",
        "symbol": "GOLD"
      },
      "sender": {
        "id": "cmiisvgqn0007xk01efv8szbq",
        "walletAddress": "0x50581102beb5cdeb68cb5f84acde46fa2deb842e",
        "emailOrWebsite": "customer@example.com"
      },
      "receiver": {
        "id": "receiver123",
        "walletAddress": "0x9876543210fedcba9876543210fedcba98765432",
        "emailOrWebsite": "receiver@example.com"
      },
      "voucherCodeId": null,
      "eventId": null,
      "createdAt": "2025-11-27T08:30:15.123Z"
    }
  ],
  "counts": 2
}
```

### Response Status Codes

| HTTP Status | Status Code | Description |
|-------------|-------------|-------------|
| 200 | 200 | Success - Transaction history retrieved |
| 404 | 404 | Not Found - Customer not found |
| 500 | 500 | Internal Server Error |

---

## 5. Get Merchant Transaction History

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

## 6. Get Wallet Balance

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

## 6. Redeem Voucher

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

## Notes

- **M/O** = Mandatory/Optional
- All timestamps are in ISO 8601 format (UTC)
- API Key must be included in the `x-api-key` header for all requests (except public endpoints like redeem and merchant transaction history)
- Phone numbers should be in Thai format (10 digits starting with 0)
- The `eventId` field in transaction responses is optional and used for tracking specific events
- Voucher redemption and merchant transaction history are public endpoints and do not require authentication
- Balance endpoint is also public for easy access
- `transactionDirection` is a computed field based on sender/receiver relationship, not stored in database
