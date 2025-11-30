# System Architecture - Blockchain Voucher Marketplace

## Overview

This is a three-tier blockchain-based voucher marketplace system that enables:
- **Sellers** to create and list vouchers for sale to merchants (paid in THB)
- **Merchants** to purchase vouchers from sellers and resell to customers (paid in Points)
- **Customers** to purchase vouchers from merchants using loyalty points

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CLIENT APPLICATIONS                              │
│  (Web/Mobile Apps, External Systems via API)                            │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ REST API
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        BACKEND APPLICATION                               │
│                         (NestJS Framework)                               │
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                 │
│  │   Voucher    │  │   Merchant   │  │   Customer   │                 │
│  │   Module     │  │    Module    │  │    Module    │                 │
│  └──────────────┘  └──────────────┘  └──────────────┘                 │
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                 │
│  │    Point     │  │     Wallet   │  │     Auth     │                 │
│  │   Module     │  │    Module    │  │    Module    │                 │
│  └──────────────┘  └──────────────┘  └──────────────┘                 │
│                                                                          │
│  ┌────────────────────────────────────────────────────┐                │
│  │         Blockchain Service Provider                │                │
│  │  (Smart Contract Interaction Layer)                │                │
│  └────────────────────────────────────────────────────┘                │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼                               ▼
        ┌───────────────────────┐       ┌──────────────────────┐
        │   PostgreSQL Database │       │  Ethereum Blockchain │
        │   (Business Data)     │       │   (Smart Contracts)  │
        └───────────────────────┘       └──────────────────────┘
                                                    │
                                    ┌───────────────┼───────────────┐
                                    │               │               │
                                    ▼               ▼               ▼
                            ┌──────────┐   ┌──────────┐   ┌──────────┐
                            │Marketplace│   │  Vault   │   │  Coupon  │
                            │ Contract  │   │ Contract │   │ Contract │
                            └──────────┘   └──────────┘   └──────────┘
                                    │
                            ┌───────┴────────┐
                            │                │
                            ▼                ▼
                    ┌──────────┐     ┌──────────┐
                    │   THB    │     │  Point   │
                    │ (ERC-20) │     │ (ERC-20) │
                    └──────────┘     └──────────┘
```

---

## Technology Stack

### Backend
- **Framework**: NestJS (TypeScript)
- **Runtime**: Node.js
- **Language**: TypeScript
- **API Style**: RESTful

### Database
- **Primary Database**: PostgreSQL
- **ORM**: Prisma
- **Migration Tool**: Prisma Migrate

### Blockchain
- **Network**: Ethereum (or EVM-compatible)
- **Library**: ethers.js v6
- **Provider**: JSON-RPC Provider
- **Wallet Management**: Private keys (encrypted)

### Smart Contracts
- **Marketplace**: Voucher listing and trading platform
- **Vault**: THB payment escrow system
- **Coupon**: ERC-1155 multi-token NFT vouchers
- **THB**: ERC-20 payment token for seller transactions
- **Point**: ERC-20 loyalty point tokens for customer purchases

---

## Core Components

### 1. Backend Modules

#### Voucher Module
**Purpose**: Manages voucher lifecycle from creation to redemption

**Key Components**:
- `voucher.controller.ts` - API endpoints
- `voucher-db.service.ts` - Database operations
- Handlers:
  - `createVoucherInterimSeller.handler.ts` - Seller creates vouchers
  - `sellerListOnMarketplace.handler.ts` - List vouchers with THB pricing
  - `merchantBuyFromSeller.handler.ts` - Merchant purchases from seller
  - `activateVoucher.handler.ts` - Merchant activates for customers
  - `buyVoucherFromMarketplace.handler.ts` - Customer purchases
  - `redeemVoucher.handler.ts` - Voucher redemption
  - `addToWhitelist.handler.ts` - Marketplace whitelist management

**Key Features**:
- Voucher metadata management
- NFT minting and tracking
- Multi-tier pricing (THB for merchants, Points for customers)
- Inventory tracking and status management

#### Merchant Module
**Purpose**: Manages merchant accounts and wallet integration

**Key Components**:
- `createMerchant.handler.ts` - Creates merchant with auto-whitelist
- `merchant-db.service.ts` - Merchant data operations

**Key Features**:
- Merchant registration
- Wallet address management
- Auto-whitelist on blockchain marketplace
- Point currency issuance

#### Customer Module
**Purpose**: Manages customer accounts and point balances

**Key Components**:
- `customer-db.service.ts` - Customer data operations
- `CustomerPoint` table management

**Key Features**:
- Customer registration by phone number
- Point balance tracking
- Purchase history
- Voucher ownership

#### Point Module
**Purpose**: Manages loyalty point currencies

**Key Features**:
- Point token creation (ERC-20)
- Multi-currency support per merchant
- Balance management
- Expiration tracking

#### Wallet Module
**Purpose**: Manages blockchain wallet addresses and private keys

**Key Features**:
- Wallet creation
- Private key encryption
- Address verification
- Transaction signing

#### Blockchain Service Provider
**Purpose**: Abstracts all smart contract interactions

**Key Methods**:
```typescript
// Coupon NFT Operations
createCouponType() - Create ERC-1155 voucher type
mintCoupon() - Mint vouchers to address
redeemVoucher() - Burn voucher on redemption
getUserCouponBalance() - Check user's voucher balance

// Marketplace Operations
listCoupon() - List vouchers for sale
buyCoupon() - Purchase from marketplace
getMarketplaceListing() - Get listing details
addToMarketplaceWhitelist() - Whitelist buyer/seller
isWhitelisted() - Check whitelist status

// Payment Token Operations
mintTHB() - Auto-mint THB for testing (Phase 1)
approveTHB() - Approve vault spending
transferPoints() - Transfer point tokens
getBalance() - Check token balance

// Vault Operations
lockFundsForCouponType() - Lock THB in escrow
releaseVaultFundsPartial() - Release on redemption
hasActiveVaultEscrow() - Check escrow status
```

---

## Database Schema

### Core Tables

#### Voucher
Stores voucher metadata and business rules
```sql
- id: string (PK, Format: "COUPON-{uuid}")
- name: string
- description: string
- status: enum (active, upcoming)
- merchantId: string (FK to Merchant)
- merchantName: string
- merchantRef: string (optional)
- tokenId: string (ERC-1155 type ID from blockchain)
- valueType: enum (cash, percentage, gift, multiplier, aispoint)
- value: float
- currency: string (nullable)
- startDate: DateTime
- endDate: DateTime
- totalIssued: int (decrements on activation)
- totalRedeemed: int
- imageUrl: string (nullable)
- limitPerMember: int (nullable)
- createdAt: DateTime
- updatedAt: DateTime
```

#### VoucherCode
Individual voucher instances with ownership tracking
```sql
- id: string (PK)
- code: string (UNIQUE, Format: "{voucherId}-{sequence}")
- voucherId: string (FK to Voucher)
- voucherGroupId: string (Marketplace listing ID from activation)
- pointsCost: int
- pointId: string (FK to Point)
- currency: string (Point symbol, denormalized)
- isUsed: boolean
- usedBy: string (Customer ID)
- usedAt: DateTime
- currentOwnerId: string (FK to Customer)
- createdAt: DateTime

Indexes:
- voucherId + isUsed (lookup available codes)
- code (unique code lookup)
- voucherGroupId (batch activation lookup)
- currentOwnerId + isUsed (user's vouchers)
- pointId (currency filtering)
```

#### Merchant
```sql
- id: string (PK)
- name: string
- description: string
- imageUrl: string
- location: string
- website: string
- tel: string
- walletId: string (FK to Wallet, UNIQUE)
- createdAt: DateTime
- updatedAt: DateTime
```

#### Customer
```sql
- id: string (PK)
- email: string
- firstName: string
- lastName: string
- tel: string (phone number for lookup)
- walletId: string (FK to Wallet, UNIQUE)
- createdAt: DateTime
- updatedAt: DateTime
```

#### Wallet
```sql
- id: string (PK)
- walletAddress: string (UNIQUE, Ethereum address)
- privateKey: string (encrypted)
- email: string
- phoneNumber: string
- type: string
- status: string
```

#### Point
```sql
- id: string (PK)
- name: string
- symbol: string (e.g., "AIS", "GOLD")
- contractAddress: bytes (ERC-20 address)
- merchantId: string (FK to Merchant)
- initialSupply: int
- decimal: int
- startDate: DateTime
- endDate: DateTime
- imageUrl: string
- createdAt: DateTime
- updatedAt: DateTime
```

#### CustomerPoint
Tracks customer point balances per currency
```sql
- id: string (PK)
- customerId: string (FK to Customer)
- pointId: string (FK to Point)
- balances: int

UNIQUE (customerId, pointId)
```

#### Transaction
Blockchain transaction tracking
```sql
- id: string (PK)
- txHash: bytes (Ethereum transaction hash)
- senderAddress: bytes
- receiverAddress: bytes
- amount: int
- transactionTypeId: string (FK to TransactionType)
- merchantId: string (FK to Merchant)
- pointId: string (FK to Point)
- voucherCodeId: string (FK to VoucherCode)
- senderId: string (FK to Customer)
- receiverId: string (FK to Customer)
- createdAt: DateTime
- updatedAt: DateTime
```

#### TransactionType
```sql
- id: string (PK, UNIQUE)
- name: string
- description: string

Types:
- "MERCHANT_PURCHASE_FROM_SELLER" - Merchant buys from seller with THB
- "MARKETPLACE_PURCHASE" - Customer buys from merchant with Points
```

---

## Smart Contract Architecture

### 1. Marketplace Contract
**Purpose**: Central trading platform for voucher listings

**Key Functions**:
```solidity
listCoupon(typeId, amount, pricePerUnit, paymentToken)
  - Lists vouchers for sale
  - Auto-increments listingId
  - Stores seller, payment token, status

buyCoupon(listingId, amount, buyer, treasuryAddress)
  - Purchases from listing
  - Transfers payment token (THB or Point)
  - Transfers NFT vouchers to buyer
  - Routes payments: vault (THB) or treasury (Points)

addToWhitelist(address)
  - Adds address to buyer/seller whitelist
  - Required before trading

isWhitelisted(address) returns (bool)
  - Checks whitelist status
```

**State Variables**:
```solidity
struct Listing {
  address seller;
  uint256 typeId;
  uint256 amountAvailable;
  uint256 pricePerUnit;
  address paymentToken;
  bool isActive;
}

mapping(uint256 => Listing) public listings;
mapping(address => bool) public whitelist;
uint256 public nextListingId;
```

### 2. Vault Contract
**Purpose**: Escrow for THB payments in seller transactions

**Key Functions**:
```solidity
lockFunds(tokenId, seller, buyer, amount, quantity)
  - Locks THB in escrow
  - Associates with specific voucher typeId
  - Records seller, buyer, amount

releaseFunds(tokenId, couponsToRedeem)
  - Releases proportional THB to seller
  - Called when customer redeems vouchers
  - Calculates: (couponsToRedeem / totalQuantity) * lockedAmount

getLockedAmount(tokenId) returns (uint256)
  - Returns locked THB amount for voucher type
```

**State Variables**:
```solidity
struct Escrow {
  address seller;
  address buyer;
  uint256 amount;
  uint256 totalQuantity;
  uint256 remainingQuantity;
}

mapping(uint256 => Escrow) public escrows; // tokenId => Escrow
```

### 3. Coupon Contract (ERC-1155)
**Purpose**: Multi-token NFT vouchers

**Key Functions**:
```solidity
createCouponType(name, startDate, expireDate) returns (uint256 typeId)
  - Creates new voucher type
  - Emits CouponTypeCreated event
  - Returns unique typeId

mint(to, typeId, amount)
  - Mints vouchers to address
  - Only owner can mint

redeem(typeId, amount)
  - Burns voucher on redemption
  - Checks ownership and validity

balanceOf(account, typeId) returns (uint256)
  - Returns voucher balance
```

**ERC-1155 Features**:
- Single contract for all voucher types
- Efficient batch operations
- Flexible metadata per typeId

### 4. THB Contract (ERC-20)
**Purpose**: Payment token for seller→merchant transactions

**Key Functions**:
```solidity
mint(to, amount)
  - Auto-mints THB for testing (Phase 1)
  
approve(spender, amount)
  - Approves vault spending
  
transferFrom(from, to, amount)
  - Used by marketplace/vault
```

### 5. Point Contract (ERC-20)
**Purpose**: Loyalty point tokens for merchant→customer transactions

**Key Functions**:
```solidity
transfer(to, amount)
  - P2P point transfers
  
approve(spender, amount)
  - Approves marketplace spending
  
balanceOf(account) returns (uint256)
  - Check point balance
```

---

## Transaction Flows

### Flow 1: Seller Creates & Lists Vouchers

```
Seller → Backend API → Database & Blockchain

1. POST /coupon/dev/interim-seller
   ├─ Create Voucher record (status: upcoming)
   ├─ blockchain.createCouponType(name, startDate, endDate)
   └─ Returns: voucherId, tokenId

2. POST /coupon/seller/list-on-marketplace
   ├─ blockchain.mintCoupon(sellerWallet, tokenId, amount)
   ├─ blockchain.listCoupon(tokenId, amount, priceTHB, THB_ADDRESS)
   ├─ Create VoucherCode records with voucherGroupId = listingId
   └─ Returns: listingId, blockchain receipt
```

**Blockchain Transactions**:
1. `Coupon.createCouponType()` - Create NFT type
2. `Coupon.mint()` - Mint vouchers to seller
3. `Coupon.setApprovalForAll(marketplace, true)` - Approve marketplace
4. `Marketplace.listCoupon()` - Create listing with THB payment

**Database Changes**:
- Voucher: Insert with tokenId
- VoucherCode: Insert batch with voucherGroupId

### Flow 2: Merchant Buys from Seller

```
Merchant → Backend API → Blockchain → Database

1. POST /coupon/merchant/buy-from-seller
   ├─ Fetch marketplace listing (validate THB payment)
   ├─ blockchain.mintTHB(merchantWallet, totalPrice) [Phase 1 auto-mint]
   ├─ blockchain.approveTHB(vault, totalPrice)
   ├─ blockchain.buyCoupon(listingId, amount, merchantPrivateKey)
   │  ├─ THB.transferFrom(merchant, vault, totalPrice)
   │  ├─ Vault.lockFunds(tokenId, seller, merchant, totalPrice, amount)
   │  └─ Coupon.safeTransferFrom(marketplace, merchant, tokenId, amount)
   ├─ Update Voucher: merchantId, status = "upcoming"
   ├─ Create Transaction record (type: MERCHANT_PURCHASE_FROM_SELLER)
   └─ Returns: purchase details, blockchain receipt
```

**Blockchain Transactions**:
1. `THB.mint()` - Auto-mint THB [Phase 1]
2. `THB.approve(vault, amount)` - Approve vault spending
3. `Marketplace.buyCoupon()` which internally:
   - Transfers THB to vault (escrow)
   - Vault locks funds with tokenId mapping
   - Transfers NFT vouchers to merchant

**Database Changes**:
- Voucher: Update merchantId, status
- Transaction: Insert purchase record
- VoucherCode: Not created yet (created during activation)

### Flow 3: Merchant Activates for Customers

```
Merchant → Backend API → Blockchain → Database

1. PATCH /coupon/activate/:voucherId
   ├─ Validate merchant ownership and NFT balance
   ├─ blockchain.addToMarketplaceWhitelist(merchantWallet) [if needed]
   ├─ blockchain.listCoupon(tokenId, amount, pricePoints, POINT_ADDRESS)
   │  ├─ Coupon.setApprovalForAll(marketplace, true)
   │  └─ Marketplace.listCoupon() - Create new listing
   ├─ Create VoucherCode batch
   │  ├─ code: "{voucherId}-{sequence}"
   │  ├─ voucherGroupId: listingId
   │  ├─ pointsCost, pointId, currency
   │  └─ currentOwnerId: null (not yet sold)
   ├─ Decrement Voucher.totalIssued
   └─ Returns: codesCreated, activeCount, upcomingCount
```

**Blockchain Transactions**:
1. `Marketplace.addToWhitelist(merchant)` - Whitelist merchant
2. `Coupon.setApprovalForAll(marketplace, true)` - Approve marketplace
3. `Marketplace.listCoupon()` - Create listing with Point payment

**Database Changes**:
- VoucherCode: Insert batch with voucherGroupId
- Voucher: Decrement totalIssued by amount

### Flow 4: Customer Buys from Merchant

```
Customer → Backend API → Blockchain → Database

1. POST /coupon/marketplace/buy
   ├─ Find customer by phone
   ├─ Find available VoucherCode (voucherGroupId, pointId, currentOwnerId=null)
   ├─ Validate point balance
   ├─ blockchain.addToMarketplaceWhitelist(customerWallet) [if needed]
   ├─ blockchain.buyCoupon(voucherGroupId, 1, customerPrivateKey, treasury)
   │  ├─ Point.transferFrom(customer, treasury, pointsCost)
   │  └─ Coupon.safeTransferFrom(marketplace, customer, tokenId, 1)
   ├─ Update VoucherCode: currentOwnerId = customerId
   ├─ Decrement CustomerPoint.balances
   ├─ Create Transaction (type: MARKETPLACE_PURCHASE)
   └─ Returns: voucherCode, voucher details, blockchain receipt
```

**Blockchain Transactions**:
1. `Marketplace.addToWhitelist(customer)` - Whitelist customer
2. `Point.approve(marketplace, pointsCost)` - Approve marketplace spending
3. `Marketplace.buyCoupon()` which internally:
   - Transfers Point to treasury (or merchant)
   - Transfers NFT voucher to customer

**Database Changes**:
- VoucherCode: Update currentOwnerId
- CustomerPoint: Decrement balances
- Transaction: Insert purchase record

### Flow 5: Customer Redeems Voucher

```
Customer → Backend API → Blockchain → Database

1. POST /coupon/redeem
   ├─ Validate VoucherCode ownership and usage status
   ├─ Validate voucher date range (startDate ≤ now ≤ endDate)
   ├─ Validate merchantRef if provided
   ├─ blockchain.redeemVoucher(tokenId, 1, customerWallet, customerPrivateKey)
   │  └─ Coupon.redeem(tokenId, 1) - Burns NFT
   ├─ blockchain.releaseVaultFundsPartial(tokenId, 1) [if THB escrow exists]
   │  ├─ Calculate: (1 / totalQuantity) * lockedAmount
   │  └─ THB.transfer(seller, releaseAmount)
   ├─ Update VoucherCode: isUsed = true, usedBy, usedAt
   ├─ Increment Voucher.totalRedeemed
   └─ Returns: redemption confirmation
```

**Blockchain Transactions**:
1. `Coupon.redeem()` - Burns voucher NFT
2. `Vault.releaseFunds()` - Releases proportional THB to seller [if applicable]

**Database Changes**:
- VoucherCode: Update isUsed, usedBy, usedAt
- Voucher: Increment totalRedeemed

---

## Payment Flow Architecture

### THB Payment Flow (Seller → Merchant)

```
Merchant Buys from Seller:
1. Merchant approves Vault to spend THB
2. Marketplace.buyCoupon() is called
3. Marketplace transfers THB from merchant to Vault (escrow)
4. Vault locks funds with tokenId mapping
5. Marketplace transfers NFT vouchers to merchant

Customer Redeems:
1. Customer burns voucher NFT
2. Backend calls Vault.releaseFunds()
3. Vault calculates proportional amount
4. Vault transfers THB to seller
```

**Why Vault?**
- Escrow protects seller until redemption
- Proportional release ensures fair payment
- Atomic redemption + payment release

### Point Payment Flow (Merchant → Customer)

```
Customer Buys from Merchant:
1. Customer approves Marketplace to spend Points
2. Marketplace.buyCoupon() is called
3. Marketplace transfers Points directly to treasury/merchant
4. Marketplace transfers NFT voucher to customer
5. No escrow - immediate payment

Customer Redeems:
1. Customer burns voucher NFT
2. No vault release (already paid)
```

**Why No Vault?**
- Merchant already owns vouchers (purchased from seller)
- Point payment is immediate and non-refundable
- Simpler flow for customer purchases

---

## Security & Access Control

### Whitelist System

**Purpose**: Control who can buy/sell on marketplace

**Implementation**:
```typescript
// Auto-whitelist on merchant creation
createMerchant.handler.ts:
  - After creating merchant
  - Checks isWhitelisted()
  - Calls addToMarketplaceWhitelist() if needed

// Auto-whitelist on activation
activateVoucher.handler.ts:
  - Before listing vouchers
  - Whitelists merchant wallet

// Auto-whitelist on purchase
buyVoucherFromMarketplace.handler.ts:
  - Before customer buys
  - Whitelists customer wallet
```

**Manual Whitelist Endpoints**:
```
POST /coupon/admin/whitelist
POST /coupon/admin/whitelist/batch
GET /coupon/admin/whitelist/:address
```

### Private Key Management

**Storage**:
- Private keys stored encrypted in database
- Wallet table with encrypted privateKey field
- Keys decrypted on-the-fly for transaction signing

**Usage**:
```typescript
// Merchant transaction
const merchantWallet = await prisma.wallet.findUnique({
  where: { id: merchant.walletId }
});
const decryptedKey = decrypt(merchantWallet.privateKey);
const signer = new Wallet(decryptedKey, provider);
```

### API Authentication

**Current**: No authentication (development mode)
```typescript
@Public() decorator on all endpoints
```

**Production**: Should implement
- API key authentication (ApiKey table exists)
- Role-based access control
- Rate limiting
- JWT tokens for user sessions

---

## Error Handling

### Blockchain Errors
```typescript
try {
  await blockchain.operation();
} catch (error) {
  console.error('[Blockchain] Failed:', error.message);
  throw new InternalServerErrorException(
    `Blockchain operation failed: ${error.message}`
  );
}
```

### Business Logic Errors
```typescript
// Validation errors
if (!voucher) {
  throw new NotFoundException('Voucher not found');
}

if (amount > voucher.totalIssued) {
  throw new BadRequestException('Amount exceeds available vouchers');
}

if (code.isUsed) {
  throw new BadRequestException('Voucher code already used');
}
```

### Transaction Rollback
Database operations wrapped in Prisma transactions:
```typescript
await prisma.$transaction(async (tx) => {
  // Update voucher code
  await tx.voucherCode.update(...);
  
  // Decrement point balance
  await tx.customerPoint.update(...);
  
  // Create transaction record
  await tx.transaction.create(...);
});
```

---

## Configuration

### Environment Variables

```bash
# Database
DATABASE_URL="postgresql://user:pass@host:5432/db"

# Blockchain
RPC_URL="https://ethereum-rpc-url"
PRIVATE_KEY="0x..." # Admin wallet private key
MARKETPLACE_ADDRESS="0x..." # Marketplace contract
VAULT_ADDRESS="0x..." # Vault contract
COUPON_ADDRESS="0x..." # Coupon ERC-1155 contract
THB_ADDRESS="0x..." # THB ERC-20 contract
POINT_FACTORY_ADDRESS="0x..." # Point token factory

# Application
PORT=3000
NODE_ENV="development"
```

### Contract Addresses (Example)
```typescript
MARKETPLACE_ADDRESS = "0x0cd9..."
VAULT_ADDRESS = "0x1d28..."
COUPON_ADDRESS = "0x..." (ERC-1155)
THB_ADDRESS = "0x..." (ERC-20)
```

---

## Performance Considerations

### Database Indexing
```sql
-- VoucherCode indexes for fast queries
CREATE INDEX idx_voucher_code_voucher_used ON "VoucherCode"("voucherId", "isUsed");
CREATE INDEX idx_voucher_code_group ON "VoucherCode"("voucherGroupId");
CREATE INDEX idx_voucher_code_owner_used ON "VoucherCode"("currentOwnerId", "isUsed");
CREATE INDEX idx_voucher_code_point ON "VoucherCode"("pointId");
```

### Blockchain Optimization
```typescript
// Batch operations where possible
await blockchain.batchMintCoupons(recipients, typeIds, amounts);

// Cache contract instances
private marketplaceContract: Contract;

// Set reasonable gas limits
{ gasLimit: 15000000 }
```

### Caching Strategy
```typescript
// Cache voucher balance queries
const balanceCache = new Map();

// Cache whitelist status
const whitelistCache = new Map();
```

---

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Production Environment                    │
│                                                              │
│  ┌────────────────┐         ┌────────────────┐             │
│  │  Load Balancer │────────▶│  NestJS App    │             │
│  │  (Nginx/ALB)   │         │  (Container)   │             │
│  └────────────────┘         └────────────────┘             │
│                                     │                        │
│                     ┌───────────────┴───────────────┐       │
│                     │                               │       │
│                     ▼                               ▼       │
│          ┌────────────────────┐         ┌────────────────┐ │
│          │  PostgreSQL RDS    │         │  Ethereum Node │ │
│          │  (Primary/Replica) │         │  (or Infura)   │ │
│          └────────────────────┘         └────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Container Configuration (Docker)
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npx prisma generate
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "start:prod"]
```

### Database Migration Strategy
```bash
# Development
npm run prisma:migrate:dev

# Production
npm run prisma:migrate:deploy
```

---

## Monitoring & Logging

### Application Logs
```typescript
// Structured logging
console.log('[Blockchain] Creating listing...');
console.log('[Blockchain] - TypeId:', typeId);
console.log('[Blockchain] - Amount:', amount);
console.log('[Blockchain] - Price:', price);

// Error logging
console.error('[Blockchain] Failed:', error.message);
```

### Blockchain Event Monitoring
```typescript
// Listen for marketplace events
marketplaceContract.on('CouponListed', (listingId, seller, typeId) => {
  console.log('New listing:', listingId);
});

marketplaceContract.on('CouponPurchased', (listingId, buyer, amount) => {
  console.log('Purchase:', listingId, buyer);
});
```

### Health Check Endpoint
```typescript
@Get('/health')
async health() {
  return {
    status: 'ok',
    database: await this.checkDatabase(),
    blockchain: await this.checkBlockchain(),
  };
}
```

---

## Future Enhancements

### Phase 2: Production Readiness
- [ ] Implement proper authentication (JWT + API keys)
- [ ] Add rate limiting
- [ ] Remove auto-mint THB (require real deposits)
- [ ] Add webhook notifications
- [ ] Implement audit logging

### Phase 3: Scalability
- [ ] Add Redis caching layer
- [ ] Implement message queue (Bull/RabbitMQ)
- [ ] Add read replicas for database
- [ ] Implement CQRS pattern
- [ ] Add GraphQL API

### Phase 4: Advanced Features
- [ ] Multi-chain support
- [ ] Secondary marketplace (C2C voucher trading)
- [ ] Voucher bundling
- [ ] Dynamic pricing
- [ ] Loyalty program integration

---

## Troubleshooting Guide

### Common Issues

**Issue**: "Buyer is not whitelisted"
```typescript
Solution: Auto-whitelist implemented in:
- createMerchant.handler.ts (merchant creation)
- activateVoucher.handler.ts (before listing)
- buyVoucherFromMarketplace.handler.ts (before purchase)

Manual whitelist: POST /coupon/admin/whitelist
```

**Issue**: "Insufficient NFT balance"
```typescript
Solution: Merchant must buy from seller first
Flow: POST /coupon/merchant/buy-from-seller
      → Then: PATCH /coupon/activate/:voucherId
```

**Issue**: "Voucher duplicate display"
```typescript
Fixed: voucher-db.service.ts line 119-121
Now counts actual VoucherCodes with voucherGroupId=null
Instead of using voucher.totalIssued
```

**Issue**: "Listing not active"
```typescript
Check: Marketplace listing status on blockchain
Verify: voucherGroupId is correct marketplace listingId
Debug: blockchain.getMarketplaceListing(listingId)
```

---

## API Documentation Reference

See comprehensive API documentation: `docs/Voucherflow.md`

Quick Reference:
- Step 0: Create & View Seller Inventory
- Step 1: Seller Lists on Marketplace (THB)
- Step 2: Merchant Buys from Seller (THB)
- Step 3: Merchant Activates for Customers (Point)
- Step 4: Customer Buys from Merchant (Point)
- Step 5: Customer Redeems Voucher

---

## Summary

This system implements a complete blockchain-based voucher marketplace with:
- ✅ Three-tier architecture (Seller → Merchant → Customer)
- ✅ Dual payment system (THB for wholesale, Points for retail)
- ✅ NFT-based vouchers (ERC-1155)
- ✅ Escrow protection for seller payments
- ✅ Whitelist access control
- ✅ Auto-mint THB for Phase 1 testing
- ✅ Complete audit trail via blockchain + database
- ✅ Flexible multi-currency point system
- ✅ Secure wallet management
- ✅ RESTful API with comprehensive error handling

The architecture balances blockchain decentralization with traditional database performance, providing a robust foundation for voucher marketplace operations.
