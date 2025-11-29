## Complete Voucher Flow (Seller → Merchant → Customer)

### Step 0: Seller creates voucher inventory (Database Only)

```
POST /coupon/dev/interim-seller
Body: {
  sellerWalletAddress: string,  // Seller's wallet address
  coupon: {
    name: string,
    description: string,
    status: "upcoming",
    merchantId: null,           // No merchant yet (optional)
    valueType: "cash" | "percentage" | "gift" | ...,
    value: number,
    pointsCost: number,         // Optional: Merchant sets during activation
    pointId: string,            // Optional: Merchant sets during activation
    startDate: string,
    endDate: string,
    totalIssued: number,        // Total vouchers available
    merchantRef: string         // Optional
  }
}
→ Creates Voucher in database with status "upcoming"
→ Creates VoucherCodes (not activated yet, no voucherGroupId)
→ Ready for seller to list on marketplace
→ Price will be set when listing (Step 1)

GET /coupon/seller/vouchers?walletAddress={sellerWallet}
→ Get all seller vouchers (merchantId = null)
→ Returns stats: totalCodes, listedCodes, soldCodes, availableForSale
→ Returns status: isListed, hasSales, fullyCreated
```

### Step 1: Seller lists vouchers on marketplace (THB Token)

```
POST /coupon/seller/list-on-marketplace
Body: {
  voucherId: string,           // Voucher ID from Step 0
  amount: number,              // How many vouchers to sell
  pricePerUnitTHB: number,     // Price per voucher in THB
  sellerWalletAddress: string  // Seller's wallet address
}
→ Validates voucher exists and has tokenId (NFT minted)
→ Validates voucher has no merchantId (seller-owned)
→ Gets seller wallet from database
→ blockchain.listCoupon() with THB token as payment
→ Returns: listingId from marketplace
→ Status: Active listing for merchants to buy
```

### Step 2: Merchant buys from Seller (THB Token)

```
POST /coupon/merchant/buy-from-seller
Body: {
  listingId: string,    // From seller's marketplace listing
  amount: number,       // How many to buy
  merchantId: string    // Merchant making purchase
}
→ Validates listing uses THB token (seller listing)
→ blockchain.buyCoupon() with THB payment token
→ Transaction: MERCHANT_PURCHASE_FROM_SELLER
→ Merchant now owns the NFT coupons on-chain
```

### Step 3: Merchant activates for Customers (Point Token)

```
PATCH /coupon/activate/:voucherId
Body: {
  amount: number,       // How many to activate
  pointsCost: number,   // Price in points for customers
  pointId: string,      // Which point currency
  currency: string      // Point symbol
}
→ Mints NFT coupons to merchant (if not already owned)
→ blockchain.listCoupon() with Point payment token
→ Creates VoucherCodes with voucherGroupId (marketplace listingId)
→ Status: Active listing for customers to buy
```

### Step 4: Customer buys from Merchant (Point Token)

```
POST /coupon/marketplace/buy
Body: {
  voucherGroupId: string,  // Marketplace listingId from activation
  pointId: string,         // Point currency to pay with
  phone: string            // Customer phone number
}
→ Validates listing uses Point token (customer listing)
→ blockchain.buyCoupon() with Point payment token
→ Transaction: MARKETPLACE_PURCHASE
→ Sets currentOwnerId to customerId
→ Customer owns the voucher code
```

---

## Summary of Payment Tokens

| Step | Who Buys | From Who | Payment Token | Endpoint                                |
| ---- | -------- | -------- | ------------- | --------------------------------------- |
| 1    | Seller   | -        | -             | Manual blockchain listing (THB)         |
| 2    | Merchant | Seller   | THB Token     | `/coupon/merchant/buy-from-seller`      |
| 3    | Merchant | -        | Point Token   | `/coupon/activate/:voucherId` (re-list) |
| 4    | Customer | Merchant | Point Token   | `/coupon/marketplace/buy`               |
