# Voucher Marketplace API Documentation

## Complete Voucher Flow (Seller → Merchant → Customer)

---

## Step 0: Seller creates voucher inventory

### `POST /coupon/dev/interim-seller`

Creates voucher metadata and mints ERC-1155 NFT type on blockchain.

**Request Body:**
```json
{
  "sellerWalletAddress": "0x1234...abcd",
  "coupon": {
    "name": "Starbucks 100 THB Voucher",
    "description": "Coffee voucher valid at all branches",
    "status": "upcoming",
    "merchantId": null,
    "valueType": "cash",
    "value": 100,
    "pointsCost": null,
    "pointId": null,
    "startDate": "2025-01-01T00:00:00.000Z",
    "endDate": "2025-12-31T23:59:59.999Z",
    "totalIssued": 1000,
    "imageUrl": "https://example.com/voucher.jpg",
    "limitPerMember": 5,
    "merchantRef": "PROMO2025"
  }
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "voucher": {
    "id": "COUPON-ffcb7d54-0237-45f1-aee8-cf05a926cbb5",
    "name": "Starbucks 100 THB Voucher",
    "description": "Coffee voucher valid at all branches",
    "status": "upcoming",
    "merchantName": "Seller",
    "merchantId": null,
    "merchantRef": "PROMO2025",
    "tokenId": "12345",
    "valueType": "cash",
    "value": 100,
    "currency": null,
    "startDate": "2025-01-01T00:00:00.000Z",
    "endDate": "2025-12-31T23:59:59.999Z",
    "totalIssued": 1000,
    "totalRedeemed": 0,
    "imageUrl": "https://example.com/voucher.jpg",
    "limitPerMember": 5,
    "createdAt": "2025-11-30T10:00:00.000Z",
    "updatedAt": "2025-11-30T10:00:00.000Z"
  },
  "pointsCost": null,
  "pointId": null,
  "pointSymbol": null,
  "message": "Voucher created successfully with tokenId: 12345",
  "note": "Voucher codes will be created when activating the voucher"
}
```

**Error Responses:**
- `404 Not Found` - Point not found (if pointId provided)
- `409 Conflict` - Point doesn't belong to merchant OR Duplicate coupon ID
- `500 Internal Server Error` - Blockchain operation failed

---

### `GET /coupon/seller/vouchers`

Get all vouchers owned by seller (not yet purchased by merchants).

**Query Parameters:**
- `walletAddress` (optional): Filter by seller wallet address

**Response:** `200 OK`
```json
{
  "success": true,
  "count": 2,
  "vouchers": [
    {
      "id": "COUPON-ffcb7d54-0237-45f1-aee8-cf05a926cbb5",
      "name": "Starbucks 100 THB Voucher",
      "description": "Coffee voucher valid at all branches",
      "status": "upcoming",
      "merchantName": "Seller",
      "merchantId": null,
      "merchantRef": "PROMO2025",
      "tokenId": "12345",
      "valueType": "cash",
      "value": 100,
      "currency": null,
      "startDate": "2025-01-01T00:00:00.000Z",
      "endDate": "2025-12-31T23:59:59.999Z",
      "totalIssued": 1000,
      "totalRedeemed": 0,
      "imageUrl": "https://example.com/voucher.jpg",
      "limitPerMember": 5,
      "createdAt": "2025-11-30T10:00:00.000Z",
      "updatedAt": "2025-11-30T10:00:00.000Z",
      "pointsCost": null,
      "pointId": null,
      "stats": {
        "totalCodes": 500,
        "listedCodes": 500,
        "soldCodes": 200,
        "availableForSale": 800
      },
      "status": {
        "isListed": true,
        "hasSales": true,
        "fullyCreated": false
      }
    }
  ]
}
```

---

## Step 1: Seller lists vouchers on marketplace

### `POST /coupon/seller/list-on-marketplace`

Seller lists vouchers on blockchain marketplace with THB as payment token.

**Request Body:**
```json
{
  "voucherId": "COUPON-ffcb7d54-0237-45f1-aee8-cf05a926cbb5",
  "amount": 500,
  "pricePerUnitTHB": 80,
  "sellerWalletAddress": "0x1234...abcd"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Voucher successfully listed on marketplace for merchants to purchase",
  "listing": {
    "voucherId": "COUPON-ffcb7d54-0237-45f1-aee8-cf05a926cbb5",
    "voucherName": "Starbucks 100 THB Voucher",
    "listingId": "28",
    "tokenId": "12345",
    "amount": 500,
    "pricePerUnitTHB": 80,
    "totalPriceTHB": 40000,
    "paymentToken": "0xTHB_CONTRACT_ADDRESS",
    "seller": "0x1234...abcd"
  },
  "blockchain": {
    "transactionHash": "0xabc123...",
    "blockNumber": 12345678
  },
  "nextSteps": {
    "message": "Merchants can now purchase this voucher using the listingId",
    "merchantEndpoint": "POST /coupon/merchant/buy-from-seller",
    "requiredData": {
      "listingId": "28",
      "amount": "Number of vouchers to purchase",
      "merchantId": "Merchant's ID from database"
    }
  }
}
```

**Error Responses:**
- `400 Bad Request` - Voucher already assigned to merchant OR No tokenId OR Amount exceeds totalIssued
- `404 Not Found` - Voucher not found OR Seller wallet not found

---

## Step 2: Merchant buys from Seller

### `POST /coupon/merchant/buy-from-seller`

Merchant purchases vouchers from seller using THB token.

**Request Body:**
```json
{
  "listingId": "28",
  "amount": 100,
  "merchantId": "merchant-uuid-1234"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Successfully purchased 100 coupons from seller",
  "purchase": {
    "listingId": "28",
    "amount": 100,
    "merchantId": "merchant-uuid-1234",
    "merchantName": "7-Eleven Thailand",
    "tokenId": "12345",
    "totalPriceWei": "8000000000000000000000",
    "totalPriceTHB": "8000.0",
    "transactionId": "tx-uuid-5678",
    "purchasedAt": "2025-11-30T11:00:00.000Z"
  },
  "blockchain": {
    "transactionHash": "0xdef456...",
    "blockNumber": 12345680,
    "seller": "0x1234...abcd",
    "paymentToken": "0xTHB_CONTRACT_ADDRESS"
  },
  "nextSteps": {
    "message": "Merchant now owns the vouchers. Activate them to list for customers.",
    "actionRequired": "Call activateVoucher endpoint to list for customers"
  }
}
```

**Note:** This endpoint creates a single transaction record with both sender (merchant) and receiver (seller) information for audit trail purposes.

**Error Responses:
- `400 Bad Request` - Merchant wallet not configured OR Listing not active OR Payment token not THB
- `404 Not Found` - Merchant not found

---

## Step 3: Merchant activates for Customers

### `PATCH /coupon/activate/:voucherId`

Merchant activates voucher batch and lists for customers using Point tokens.

**Path Parameters:**
- `voucherId`: Voucher ID to activate

**Request Body:**
```json
{
  "amount": 50,
  "pointsCost": 100,
  "pointId": "point-uuid-1234",
  "currency": "AIS"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Activated 50 codes successfully. Active: 50, Upcoming: 50",
  "voucherId": "COUPON-ffcb7d54-0237-45f1-aee8-cf05a926cbb5",
  "codesCreated": 50,
  "activeCodesCount": 50,
  "upcomingCodesCount": 50,
  "pointsCost": 100,
  "pointId": "point-uuid-1234",
  "currency": "AIS"
}
```

**Error Responses:**
- `400 Bad Request` - Amount exceeds remaining totalIssued OR Currency mismatch OR Insufficient NFT balance
- `404 Not Found` - Voucher not found OR Point not found

---

## Step 4: Customer buys from Merchant

### `POST /coupon/marketplace/buy`

Customer purchases voucher from marketplace using Point tokens.

**Request Body:**
```json
{
  "voucherGroupId": "29",
  "pointId": "point-uuid-1234",
  "phone": "0812345678"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Voucher purchased successfully from marketplace",
  "purchase": {
    "voucherCodeId": "code-uuid-9999",
    "code": "COUPON-ffcb7d54-0237-45f1-aee8-cf05a926cbb5-00001",
    "address": "0xCUSTOMER_WALLET_ADDRESS",
    "customerId": "customer-uuid-7777",
    "purchasePrice": 100,
    "transactionId": "tx-uuid-8888",
    "purchasedAt": "2025-11-30T12:00:00.000Z"
  },
  "voucher": {
    "id": "COUPON-ffcb7d54-0237-45f1-aee8-cf05a926cbb5",
    "name": "Starbucks 100 THB Voucher",
    "description": "Coffee voucher valid at all branches",
    "valueType": "cash",
    "value": 100,
    "merchantName": "7-Eleven Thailand",
    "startDate": "2025-01-01T00:00:00.000Z",
    "endDate": "2025-12-31T23:59:59.999Z"
  },
  "blockchain": {
    "transactionHash": "0xghi789...",
    "blockNumber": 12345690
  }
}
```

**Note:** This endpoint creates a single transaction record with both sender (customer) and receiver (merchant) information. When querying transaction history, a `transactionDirection` field indicates whether the user sent or received points.

**Error Responses:
- `400 Bad Request` - Code already used OR Voucher expired OR Insufficient point balance OR Listing not active
- `404 Not Found` - Customer not found (by phone) OR No available voucher code

---

## API Summary

| Step | Endpoint                            | Method | Payment Token | Who      | Action                  |
| ---- | ----------------------------------- | ------ | ------------- | -------- | ----------------------- |
| 0    | `/coupon/dev/interim-seller`        | POST   | -             | Seller   | Create voucher          |
| 0    | `/coupon/seller/vouchers`           | GET    | -             | Seller   | View inventory          |
| 1    | `/coupon/seller/list-on-marketplace`| POST   | THB           | Seller   | List on marketplace     |
| 2    | `/coupon/merchant/buy-from-seller`  | POST   | THB           | Merchant | Buy from seller         |
| 3    | `/coupon/activate/:voucherId`       | PATCH  | Point         | Merchant | Activate for customers  |
| 4    | `/coupon/marketplace/buy`           | POST   | Point         | Customer | Buy from merchant       |
