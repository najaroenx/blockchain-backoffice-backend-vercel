# Transaction Types Documentation

This document describes all available transaction types in the system and their use cases.

## Overview

Transactions are tracked in the `Transaction` table and categorized using `TransactionType`. Each transaction can be associated with either:
- **Points** (via `pointId`): Point-based transactions
- **Vouchers** (via `voucherCodeId`): Voucher ownership and transfer transactions

**Note:** `pointId` and `voucherCodeId` are mutually exclusive - a transaction can only be associated with one or the other, never both.

## Transaction Type Enum

Use the `TransactionTypeId` enum from `src/constants/transaction-types.enum.ts` when creating transactions:

```typescript
import { TransactionTypeId } from 'src/constants/transaction-types.enum';

// Example usage
await prisma.transaction.create({
  data: {
    // ... other fields
    transactionTypeId: TransactionTypeId.MARKETPLACE_PURCHASE,
  },
});
```

## Point-Related Transactions

These transactions should have `pointId` set and `voucherCodeId` as `null`.

### 1. MINT
- **Purpose**: Create new points for a customer
- **Use Case**: Initial point allocation, promotional credits, admin point grants
- **Fields**: 
  - `amount`: Number of points minted
  - `receiverId`: Customer receiving the points
  - `pointId`: The point type being minted

### 2. BURN
- **Purpose**: Destroy/remove points from circulation
- **Use Case**: Point expiration, admin corrections, fraud prevention
- **Fields**:
  - `amount`: Number of points burned
  - `senderId`: Customer whose points are burned
  - `pointId`: The point type being burned

### 3. TRANSFER
- **Purpose**: Move points between customers
- **Use Case**: P2P point transfers, gift points to friends
- **Fields**:
  - `amount`: Number of points transferred
  - `senderId`: Customer sending points
  - `receiverId`: Customer receiving points
  - `pointId`: The point type being transferred

### 4. EARN
- **Purpose**: Customer earns points through activities
- **Use Case**: Purchase rewards, loyalty bonuses, referral rewards
- **Fields**:
  - `amount`: Number of points earned
  - `receiverId`: Customer earning the points
  - `pointId`: The point type earned

### 5. REDEEM
- **Purpose**: Customer spends points on rewards/vouchers
- **Use Case**: Redeem points for vouchers, products, or services
- **Fields**:
  - `amount`: Number of points spent
  - `senderId`: Customer redeeming points
  - `pointId`: The point type being redeemed

## Voucher-Related Transactions

These transactions should have `voucherCodeId` set and `pointId` as `null`.

### 6. MARKETPLACE_PURCHASE
- **Purpose**: Customer purchases a voucher from the marketplace using points
- **Use Case**: Buy voucher from marketplace smart contract
- **Fields**:
  - `amount`: Price in points
  - `senderId`: Buyer (customer ID)
  - `receiverId`: Buyer (customer ID) - same as sender
  - `voucherCodeId`: The voucher code being purchased
- **Side Effects**:
  - Updates `VoucherCode.currentOwnerId` to the buyer
  - Creates blockchain transaction via smart contract

**Example:**
```typescript
// In buyCouponFromMarketplace.handler.ts
await prisma.transaction.create({
  data: {
    txHash: Buffer.from(blockchainTx.hash.slice(2), 'hex'),
    senderAddress: Buffer.from(address.slice(2), 'hex'),
    receiverAddress: Buffer.from(address.slice(2), 'hex'),
    amount: voucherCode.pointsCost,
    senderId: customerId,
    receiverId: customerId,
    voucherCodeId: voucherCodeId,
    transactionTypeId: TransactionTypeId.MARKETPLACE_PURCHASE,
  },
});
```

### 7. VOUCHER_TRANSFER
- **Purpose**: Transfer voucher ownership between customers (marketplace resale)
- **Use Case**: Sell voucher on secondary marketplace, transfer to another user
- **Fields**:
  - `amount`: Transfer price (0 for free transfers)
  - `senderId`: Current owner
  - `receiverId`: New owner
  - `voucherCodeId`: The voucher code being transferred
- **Side Effects**:
  - Updates `VoucherCode.currentOwnerId` to the new owner
  - May involve blockchain transaction

### 8. VOUCHER_GIFT
- **Purpose**: Gift a voucher to another customer (no payment)
- **Use Case**: Send voucher as a gift, promotional giveaways
- **Fields**:
  - `amount`: 0 (no payment involved)
  - `senderId`: Gifter
  - `receiverId`: Recipient
  - `voucherCodeId`: The voucher code being gifted
- **Side Effects**:
  - Updates `VoucherCode.currentOwnerId` to the recipient

## Database Schema Relationships

```prisma
model Transaction {
  id                String           @id @default(cuid())
  transactionTypeId String
  transactionType   TransactionType  @relation(fields: [transactionTypeId], references: [id])
  
  // Mutually exclusive: either pointId OR voucherCodeId
  pointId           String?          // For point transactions
  point             Point?           @relation(fields: [pointId], references: [id])
  
  voucherCodeId     String?          // For voucher transactions
  voucherCode       VoucherCode?     @relation(fields: [voucherCodeId], references: [id])
  
  // Common fields
  amount            Int
  senderId          String?
  receiverId        String?
  txHash            Bytes
  // ... other fields
}

model VoucherCode {
  id             String       @id @default(cuid())
  currentOwnerId String?      // Current voucher owner
  currentOwner   Customer?    @relation("OwnedVouchers", fields: [currentOwnerId], references: [id])
  transactions   Transaction[] // Transaction history
  // ... other fields
}
```

## Seeding

All transaction types are automatically seeded when running:

```bash
yarn prisma db seed
```

The seed data is defined in `prisma/seed.ts` in the `seedTransactionTypes()` function.

## Usage Guidelines

1. **Always use the enum**: Import and use `TransactionTypeId` enum instead of hardcoding strings
2. **Point vs Voucher**: Ensure `pointId` and `voucherCodeId` are mutually exclusive
3. **Ownership tracking**: For voucher transactions, always update `VoucherCode.currentOwnerId`
4. **Blockchain integration**: MARKETPLACE_PURCHASE and VOUCHER_TRANSFER may involve blockchain transactions
5. **Type safety**: The enum provides compile-time checking and IDE autocomplete

## Example Queries

### Get all marketplace purchases by a customer
```typescript
const purchases = await prisma.transaction.findMany({
  where: {
    receiverId: customerId,
    transactionTypeId: TransactionTypeId.MARKETPLACE_PURCHASE,
  },
  include: { voucherCode: true },
});
```

### Get transaction history for a voucher
```typescript
const history = await prisma.transaction.findMany({
  where: { voucherCodeId: voucherCodeId },
  include: {
    transactionType: true,
    sender: true,
    receiver: true,
  },
  orderBy: { createdAt: 'desc' },
});
```

### Get point earning history
```typescript
const earnings = await prisma.transaction.findMany({
  where: {
    receiverId: customerId,
    transactionTypeId: TransactionTypeId.EARN,
  },
  include: { point: true },
});
```
