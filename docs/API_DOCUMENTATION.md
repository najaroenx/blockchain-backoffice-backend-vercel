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
| receiverPhone | String | M | เบอร์โทรศัพท์ของผู้รับ | 0984360421 |

**Example Request Body:**
```json
{
  "amount": 10,
  "receiverPhone": "0984360421"
}
```

### Response

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

### Response Status Codes

| HTTP Status | Status Code | Description |
|-------------|-------------|-------------|
| 201 | 201 | Success - Transaction completed |
| 400 | 400 | Bad Request - Invalid parameters |
| 401 | 401 | Unauthorized - Invalid API Key |
| 404 | 404 | Not Found - Customer or Point not found |
| 500 | 500 | Internal Server Error |

---

## Notes

- **M/O** = Mandatory/Optional
- All timestamps are in ISO 8601 format (UTC)
- API Key must be included in the `x-api-key` header for all requests
- Phone numbers should be in Thai format (10 digits starting with 0)
- The `eventId` field in transaction responses is optional and used for tracking specific events
