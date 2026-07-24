# Production Remediation Plan — Voucher Direct Transfer Drift + Truthful Balances

สถานะ: **Draft updated from owner review — รอ final implementation approval**

วันที่ปรับแผน: 2026-07-24

เอกสารอ้างอิง:

- [`problem.md`](./problem.md) — หลักฐานและ root cause จาก production
- [`DIRECT_TRANSFER_QUERIES.md`](./DIRECT_TRANSFER_QUERIES.md) — query สำหรับ audit
- Requirement ต้นฉบับ: `/Users/subtawen/Downloads/dev-plan-phase1-2.md`

## 1. เป้าหมาย

แก้ production โดยใช้เวลาน้อยที่สุดตามลำดับนี้:

1. หยุด Direct Transfer ไม่ให้หยิบ Voucher Code ที่ถูกจองให้ Marketplace
2. รักษา Direct Transfer ให้ใช้งานต่อได้ โดยไม่เปลี่ยน request contract
3. ป้องกัน concurrent request หยิบ Voucher Code ซ้ำแบบถาวร
4. แสดงยอดคูปองจากแหล่งข้อมูลที่ถูกต้อง โดยไม่ใช้ DB ไปแก้ยอดบนเชนอัตโนมัติ
5. เพิ่ม audit trail เพื่อบอกได้ว่าแต่ละ transfer มาจาก Wallet Pool หรือ Marketplace

## 2. ขอบเขตที่ล็อกแล้ว

### 2.1 Product decisions

- **D1 — Direct Transfer ไม่ใช่การขายด้วย Point**
  - ห้ามผูก `voucherGroupId` หรือ listing ของ Marketplace
  - Direct Transfer ทุก currency ไม่ต้องรับ, resolve หรือเขียน `pointId`
  - Direct Transfer ต้องคง `currency` ตาม Voucher configuration:
    `THB` ใช้ `"THB"` และ Point currency ใช้ `Point.symbol`
  - `pointId` เป็น payment/activation metadata ของ Marketplace flow
    ไม่ใช่เงื่อนไขว่า Customer redeem Coupon ได้หรือไม่
  - ตอน redeem ถ้ามี `pointId` ใช้เป็น metadata/legacy transaction-receiver
    fallback ได้ แต่ถ้าไม่มีต้องไม่ block redemption
  - ร้านที่รับ Redeem จริงคือ `Voucher.merchantRef` ซึ่งต้องตรงกับ
    `merchantRef` ใน request; ห้ามหา merchantRef จาก Point หรือ Marketer
  - `Transaction.receiverId` คง compatibility เดิมสำหรับ Merchant/wallet
    accounting ส่วน `Transaction.merchantRef` ระบุร้านที่รับ Redeem จริง
  - ต้อง resolve transaction receiver และ merchant wallet ให้สำเร็จก่อน burn
    Coupon บนเชน
  - `MerchantRefStore.isActive` ใช้กรอง query เท่านั้น ไม่ใช่ Redeem validation
- **D2 — ยอมรับยอด “โอนตรงได้” ที่ลดลง**
  - ยอดใหม่ต้องสะท้อนเฉพาะของที่โอนตรงได้จริง
  - ต้องเตรียมข้อความให้ Support/Merchant ก่อน production rollout
- Direct Transfer **ต้องเปิดใช้งานต่อ** ห้ามใช้ kill switch เป็นทางแก้หลัก
- Request payload ของ Direct Transfer **ห้ามเปลี่ยน**
- Deploy เป็น 2 release:
  - **Release A:** containment แบบเร็ว
  - **Release B:** persistent reservation และ operation audit
- ไม่แก้ข้อมูล historical ในแผนนี้
  - ไม่ย้าย Voucher Code เก่า
  - ไม่ backfill classification แบบเดา
  - ไม่ mint/burn/transfer token เพื่อซ่อมยอดเก่า
  - ทำได้เฉพาะ report, monitor และ alert

### 2.2 Decisions ที่ยังรอ แต่ไม่ block Release A

| Decision | ต้องได้คำตอบก่อน | ค่าเสนอ |
|---|---|---|
| D3: รายชื่อ dev/test wallet ที่ต้อง exclude | เริ่ม P2-4 | ใช้ allowlist จาก owner |
| D4: cache TTL ของยอดบนจอ | finalize P2 config | 60 วินาที |
| D5: alert destination และผู้รับผิดชอบ | เปิด production health job | channel ของทีม + on-call owner |
| D6: attribution ตอน Redeem | **ยืนยันแล้ว** | A = Coupon owner, B = Marketer ผู้ขาย, C = `merchantRef` ที่รับ Redeem; ใช้ `Transaction.merchantRef` เดิมสำหรับ C และไม่เพิ่ม `redemptionMerchantId` |

เมื่อถึงงานที่ถูก block ด้วย D3-D5 ต้องหยุดและถาม owner ก่อน ห้ามตัดสินใจแทน

## 3. Domain definitions และ invariants

### 3.1 Pool definitions

**Wallet Pool / Direct-transfer eligible row**

```text
currentOwnerType = MERCHANT
currentOwnerId   = merchantId
voucherId        = requested voucherId
isUsed           = false
voucherGroupId   = NULL
pointId          = NULL
และใน Release B: ไม่มี active reservation จาก DirectTransferOperation
```

**Marketplace Reserved**

- Voucher Code ถูกจัดสรรให้ listing/batch ของ Marketplace
- มี `voucherGroupId` หรือ relation ที่ระบุการจองให้ Marketplace
- ห้าม Direct Transfer หยิบ row นี้ แม้ DB หรือเชนแสดงว่ายังมี quantity

**Customer Held**

- `currentOwnerType = CUSTOMER`
- `isUsed = false`

**Redeemed**

- `currentOwnerType = CUSTOMER`
- `isUsed = true`

### 3.2 Lifecycle classification

ห้ามใช้ `pointId` เป็นตัวตัดสิน `upcoming`/`active` เพราะ THB และ Direct Transfer
สามารถมี `pointId = NULL` ได้อย่างถูกต้อง

ให้ derive state จาก ownership และ flow:

```text
CUSTOMER + isUsed=true                         -> REDEEMED
CUSTOMER + isUsed=false                        -> CUSTOMER_HELD
มี active DirectTransferOperation reservation -> DIRECT_TRANSFER_RESERVED
มี voucherGroupId + listing ยัง active        -> MARKETPLACE_RESERVED
MERCHANT + unused + no group + no reservation -> WALLET_POOL
กรณีอื่น                                      -> LEGACY_UNCLASSIFIED
```

ถ้ายังต้องรักษา response `upcoming`/`active` เดิม:

```text
upcoming = WALLET_POOL
active   = MARKETPLACE_RESERVED หรือ CUSTOMER_HELD
```

ควรเพิ่ม `inventoryState` แบบ additive เพื่อไม่ให้คำว่า `active` รวมหลายความหมาย
และใช้ shared classifier/query builder ตัวเดียวในทุก service

`pointId` ใช้แยกเฉพาะ payment configuration:

```text
THB payment          -> currency=THB, pointId=NULL
Marketplace Point    -> currency=Point.symbol, pointId=Point.id
Direct Transfer      -> ไม่มี Point payment; ไม่ set pointId
```

### 3.3 Source of truth

- On-chain balance เป็น source of truth ของ **quantity ที่ wallet/escrow ถือ**
- DB เป็น source of truth ของ **Voucher Code identity, business ownership projection, redemption state และ history**
- DB mismatch ไม่ใช่เหตุผลให้ mint หรือแก้ on-chain balance อัตโนมัติ
- Direct Transfer ส่งได้สูงสุด:

```text
directTransferableNow =
  min(onchain merchant-wallet balance, eligible Wallet Pool rows)
```

### 3.4 Metrics ที่ต้องใช้ให้ถูกความหมาย

- ห้ามใช้ `pointId IS NULL` เพียงอย่างเดียวเป็น metric “never activated”
- `pointId IS NULL` ของ Direct Transfer ไม่ใช่ข้อมูลเสีย
- Dashboard ต้องใช้:

```text
total      = VoucherCode ทั้งหมด
sold       = currentOwnerType = CUSTOMER
unsold     = currentOwnerType != CUSTOMER
unredeemed = CUSTOMER และ isUsed=false
redeemed   = CUSTOMER และ isUsed=true
```

- ต้องรักษา `total = sold + unsold` และ `sold = unredeemed + redeemed`
- ข้อมูลเก่าทุก row ยังอยู่ใน total/sold/unsold ตาม ownership
- Historical transfer ที่ไม่มี immutable `sourcePool` ต้องแสดงเป็น `legacyUnclassified`
  ห้ามเดาว่าเป็น Wallet Pool หรือ Active Marketplace ใน API หลัก

### 3.5 Redeem actor attribution

```text
A = Coupon owner / original issuer
B = Marketer ผู้ขาย Coupon ให้ Customer
C = Voucher.merchantRef ร้านที่รับ Redeem จริง
```

- `redeemed` ของ B หมายถึง Coupon ที่ B ขายและถูกใช้แล้ว ไม่ได้หมายถึง
  Redeem เกิดที่ร้าน B
- Redeem ของร้าน C query จาก `Transaction.merchantRef` หรือ
  `Voucher.merchantRef`
- `Transaction.receiverId` ไม่ใช่ตัวระบุร้าน C และห้ามใช้แทน merchantRef
- คูปองหนึ่งใบอาจปรากฏใน attribution ของ A, B และ C ตามคนละบทบาท
  แต่ยอดรวมระดับระบบต้องนับ Voucher Code ใบนั้นเพียงครั้งเดียว
- request `merchantRef` เป็นค่าที่ผู้ใช้กรอกเพื่อเทียบกับ
  `Voucher.merchantRef` ซึ่งเป็น canonical value ตั้งแต่สร้าง Coupon
- ถ้า Voucher ไม่มี merchantRef หรือ request ไม่ตรง ให้ reject ก่อน on-chain call
- ห้ามตรวจ `MerchantRefStore.isActive` ใน Redeem flow
- Redeem transaction เก่าที่ไม่มี merchantRef แสดงเป็น `legacyUnclassified`
  และห้ามเดาจาก Point, Coupon owner หรือ Marketer

## 4. Findings จาก code ปัจจุบัน

1. `lockAvailableMerchantVoucherCodes()` กรองเพียง owner + `isUsed=false`
   จึงมีโอกาสหยิบ row ที่จองให้ Marketplace
2. Query ใช้ `FOR UPDATE SKIP LOCKED` แต่ไม่ได้อยู่ใน transaction ที่ครอบตั้งแต่
   select/claim จนถึงการสร้าง reservation
   ดังนั้น lock ถูกปล่อยหลัง query จบและยังป้องกัน concurrent transfer ไม่ได้จริง
3. Entry points ที่ต้องใช้ eligibility เดียวกัน:
   - single Direct Transfer
   - batch Direct Transfer
   - batch CSV execute
   - batch CSV preview
   - admin rewards CSV preselection
4. `BlockchainService.transferCoupon()` รอ transaction confirmation ก่อนคืนค่า
   ทำให้ปัจจุบันยัง persist tx hash ระหว่าง `SUBMITTED` ไม่ได้
5. Request DTO ปัจจุบันไม่มี `pointId` และ requirement ล็อกแล้วว่าห้ามเปลี่ยน request
6. Redeem ปัจจุบัน reject non-THB ที่ไม่มี `pointId`
   แม้ core redemption จะใช้เพียง Coupon `tokenId`, ownership, merchantRef,
   customer wallet และ on-chain balance
7. Redeem ปัจจุบัน burn Coupon บนเชนก่อน resolve merchant/wallet
   ถ้า resolve ไม่ได้จะเกิด chain confirmed แต่ DB ยังไม่ mark used
8. เหตุผลเดิมที่ใช้ `Point.merchantId` คือ Seller Voucher เคยมี
   `Voucher.merchantId = NULL` และ Point ถูกใช้เป็น proxy ของ merchant ผู้ activate
9. Resolver มี field อื่นแล้ว:
   `Voucher.merchantId`, `Voucher.sellerMerchantId` และ legacy name fallback
   แต่ `merchantRef` ยังไม่มี FK ตรงไป `Merchant`/wallet
10. Read-only audit จาก DB ที่ `.env` ปัจจุบันชี้อยู่:
    - Voucher 24/24 มี valid `sellerMerchantId`
    - Customer-owned codes 215/215 resolve merchant จาก Voucher fields ได้
    - 158 codes ที่มี Point: `Point.merchantId` ตรงกับ Voucher merchant ทั้งหมด
    - 57 codes ไม่มี Point และเป็น THB; ไม่มี unknown/non-THB ในกลุ่มนี้
    - REDEEM transactions 60/60 มี receiver ตรงทั้ง Point และ Voucher merchant
11. `fixOnchain` และ backfill `--execute` สามารถเปลี่ยน chain/DB จากค่าที่ drift อยู่
   จึงต้องปิด write mode ก่อน

## 5. Delivery strategy

| Release | เป้าหมาย | เวลาโดยประมาณ | Migration |
|---|---|---:|---|
| A | หยุดหยิบ Marketplace row, แก้ redeem ordering และปิด auto-fix | ~0.5-1 วัน | ไม่มี |
| B | reservation ข้าม chain wait, operation state และ immutable source | ~1-1.5 วัน | additive |
| Phase 2 | อ่านและแสดงยอดจริงจากเชน + health monitoring | ~4-6 วัน | อาจมีเฉพาะ config/index |

Release A ต้องขึ้น production ก่อน จากนั้นจึง deploy Release B

---

## 6. Release A — Fast containment

### A0. เก็บ baseline ก่อน deploy

- รัน audit แบบ read-only จาก `DIRECT_TRANSFER_QUERIES.md`
- บันทึกอย่างน้อย:
  - Direct Transfer ที่ผูก Active Marketplace
  - Customer-held แยกตาม currency และการมี/ไม่มี `pointId`
  - coverage ของ `Voucher.merchantId`/`sellerMerchantId`
  - ความต่างระหว่าง Point merchant, Voucher merchant และ REDEEM receiver
  - on-chain merchant wallet balance
  - on-chain marketplace escrow balance
  - eligible Wallet Pool rows
- บันทึกเวลา, environment, block number และ commit SHA
- ห้ามใช้ `fixOnchain`, `sync=true` หรือ backfill `--execute`

**Output:** baseline artifact สำหรับเทียบหลัง deploy

### A1. ทำ eligibility ให้เป็นนิยามเดียว

สร้าง shared predicate/query builder สำหรับ Wallet Pool แล้วให้ทุก path ใช้ร่วมกัน:

```sql
SELECT *
FROM "VoucherCode"
WHERE "voucherId" = $1
  AND "currentOwnerId" = $2
  AND "currentOwnerType" = 'MERCHANT'
  AND "isUsed" = false
  AND "voucherGroupId" IS NULL
  AND "pointId" IS NULL
ORDER BY "id"
LIMIT $3
FOR UPDATE SKIP LOCKED;
```

ไฟล์หลัก:

- `src/modules/internal/voucher/utils/direct-voucher-transfer.util.ts`
- single transfer handler
- batch transfer handler
- batch CSV execute handler
- batch CSV preview handler
- admin rewards CSV handler

ข้อกำหนด:

- CSV preview และ execution ต้องนับ/เลือกด้วย predicate เดียวกัน
- admin rewards preselection ห้าม query candidate ด้วยเงื่อนไขที่กว้างกว่า
- ถ้าจำนวน row ไม่พอ ให้ตอบ error code คงที่:

```json
{
  "code": "INSUFFICIENT_WALLET_POOL",
  "voucherId": "...",
  "requested": 10,
  "available": 7
}
```

- ห้าม fallback ไป Marketplace Reserved pool
- ห้ามอ้างว่า Release A แก้ concurrency สมบูรณ์ เพราะ row lock ยังไม่ครอบ chain wait

### A2. แยก Point payment ออกจาก Direct Transfer และ Redeem

#### Direct Transfer

- ห้ามเพิ่ม `pointId` ใน request
- ห้าม lookup/resolve Point เพื่อทำ Direct Transfer
- ห้ามเขียน `pointId` หลัง transfer
- คง `currency` เดิม:
  - THB ใช้ `"THB"`
  - Point-based Voucher ใช้ `Point.symbol` ที่ตั้งไว้ใน Voucher configuration
- Direct Transfer ไม่หัก Point และไม่สร้าง CustomerPoint transaction
- หลัง chain confirm:
  - เปลี่ยน business owner เป็น CUSTOMER
  - คง `voucherGroupId = NULL`
  - คง `pointId` เดิม (`NULL` สำหรับ Wallet Pool)
  - บันทึก VOUCHER TRANSFER transaction ตาม flow เดิม

#### Redeem

Point ไม่ได้ถูกหักหรือโอนตอน redeem จึงห้ามใช้การไม่มี `pointId` เป็น blocking
validation

ลำดับใหม่:

```text
validate code/owner/isUsed/date
  -> require Voucher.merchantRef
  -> compare request merchantRef = Voucher.merchantRef
  -> resolve legacy transaction receiver
  -> verify merchant + wallet
  -> verify customer on-chain Coupon balance
  -> burn/redeem Coupon on-chain
  -> mark VoucherCode used + write REDEEM transaction
```

Release A ต้องรักษา historical `Transaction.receiverId` behavior ด้วย resolver
order:

1. ถ้ามี `pointId` ใช้ `Point.merchantId` เป็น legacy compatibility
2. ถ้าไม่มี/หาไม่ได้ ใช้ `Voucher.merchantId`
3. จากนั้นใช้ `Voucher.sellerMerchantId`
4. legacy name fallback เป็นทางสุดท้าย พร้อม warning

resolver นี้มีไว้สำหรับ transaction/wallet compatibility ไม่ใช่การหาร้าน C
ซึ่งมาจาก `Voucher.merchantRef` เท่านั้น

ถ้า resolve merchant หรือ wallet ไม่ได้ ให้ตอบ
`REDEMPTION_MERCHANT_NOT_FOUND` **ก่อน** blockchain call

`pointId` ที่มีอยู่ยังบันทึกใน REDEEM transaction/response เป็น metadata ได้
แต่ `pointId = NULL` ต้องไม่ทำให้ redemption fail

คำว่า metadata ในงานนี้หมายถึง **payment/transaction history**
ไม่ใช่ activation หรือ redemption eligibility

### A3. ปิด reconciliation write mode

- endpoint/handler ที่รับ `fixOnchain=true` ต้อง reject ด้วย stable error
- path ที่ใช้ `sync=true` แล้ว mutate DB ต้อง reject เช่นกัน
- reconciliation แบบ read-only/report-only ยังใช้ได้
- `scripts/fix-wallet-marketplace-backfill.ts --execute` ต้อง exit ก่อนเขียนข้อมูล
- ห้าม scheduled job ใด mint/burn/transfer token จาก DB diff

ข้อผิดพลาดต้องอธิบายว่า:

```text
AUTOMATIC_RECONCILIATION_DISABLED
Use report-only audit. Historical repair requires an approved runbook.
```

### A4. Tests

อย่างน้อยต้องมี:

- Marketplace Reserved row ไม่ถูกเลือก
- Wallet Pool หมดแล้วตอบ `INSUFFICIENT_WALLET_POOL`
- ไม่มี fallback ไป pool อื่น
- CSV preview count ตรงกับ execution eligibility
- admin rewards ใช้ eligibility เดียวกัน
- Direct Transfer ทุก currency ไม่ lookup หรือเขียน `pointId`
- THB และ Point-symbol Voucher ที่มาจาก Direct Transfer redeem ได้เมื่อ
  `pointId = NULL`
- การไม่มี Point ไม่ block redemption
- historical code ที่มี Point ยัง resolve receiver เหมือนเดิม
- merchant/wallet resolve ไม่ผ่านต้องไม่มี blockchain redeem call
- merchant/wallet resolve ผ่านก่อนตรวจ balance และ burn
- lifecycle classifier ไม่ใช้ `pointId` ตัดสิน `upcoming`/`active`
- Dashboard รักษา `total = sold + unsold`
  และ `sold = unredeemed + redeemed`
- `fixOnchain`, mutating `sync` และ backfill `--execute` ถูก block
- existing targeted test suite ผ่าน
- build ผ่าน

Concurrent test ใน Release A ใช้ยืนยันว่าไม่เลือก Marketplace row
แต่ยังไม่ใช้เป็นหลักฐานว่าแก้ race สมบูรณ์ งานนั้นอยู่ Release B

### A5. Staging และ production rollout

1. Deploy staging
2. รัน read-only audit เทียบ A0
3. Smoke test single, batch, CSV และ admin rewards
4. แจ้ง Support ตาม D2
5. Deploy production
6. ตรวจทันทีหลัง deploy, +30 นาที, +24 ชั่วโมง, +3 วัน และ +14 วัน

Release A success criteria:

- จำนวน Direct Transfer ใหม่ที่ผูก Marketplace listing = 0
- Direct Transfer ใหม่ไม่เขียน `pointId` และไม่สร้าง Point payment
- ไม่มี Coupon ถูก burn ก่อน merchant/wallet validation ผ่าน
- Direct-transferred Coupon ที่ไม่มี Point redeem ได้ตาม ownership/merchantRef
- ไม่มี automatic reconciliation write
- Direct Transfer ปกติยังทำงานได้

Rollback:

- revert application release ได้เพราะไม่มี migration
- rollback จะเปิดความเสี่ยงเดิมอีกครั้ง จึงใช้เฉพาะเมื่อ Direct Transfer ใช้งานไม่ได้

---

## 7. Release B — Persistent reservation and operation audit

Release B แก้ race ที่ Release A ยังแก้ไม่ได้ เพราะไม่ควรถือตัว DB transaction/row lock
ค้างระหว่างรอ blockchain confirmation

### B1. Additive schema

เพิ่ม operation ที่มี state ชัดเจน:

```text
PREPARED
SUBMITTED
CONFIRMED
CHAIN_FAILED
DB_FAILED
MANUAL_REVIEW
```

ข้อมูลขั้นต่ำ:

- operation ID
- merchant, customer, voucher, quantity
- reserved Voucher Code IDs
- source pool = `WALLET_POOL`
- status
- tx hash
- error/recovery note
- timestamps

เพิ่ม immutable `sourcePool` ที่ Transaction:

```text
WALLET_POOL
ACTIVE_MARKETPLACE_POOL
```

ข้อกำหนด schema:

- migration เป็น additive และ nullable สำหรับข้อมูลเก่า
- historical row ที่ไม่มี source ต้องคงเป็น unclassified
- ห้าม infer แล้วเขียนกลับโดยไม่มี approved repair plan
- allocation ของ Voucher Code ต้องมี unique constraint เพื่อกัน code เดียวอยู่ใน
  active operation มากกว่าหนึ่งรายการ
- ไม่เพิ่ม `redemptionMerchantId`; ใช้ `Transaction.merchantRef` ที่มีอยู่แล้ว
  เป็นร้าน C

### B2. Atomic claim flow

```text
DB transaction:
  select eligible Wallet Pool rows FOR UPDATE SKIP LOCKED
  verify quantity
  create PREPARED operation
  claim selected Voucher Codes
commit

submit blockchain transaction
persist SUBMITTED + txHash
wait for receipt

DB transaction:
  update owner เป็น CUSTOMER โดยไม่เปลี่ยน pointId
  write Transaction(sourcePool=WALLET_POOL)
  mark operation CONFIRMED
commit
```

Marketplace purchase flow ต้องเขียน
`sourcePool=ACTIVE_MARKETPLACE_POOL` จาก flow context โดยตรง
ห้ามคำนวณย้อนหลังจาก mutable Voucher Code fields

### B3. Failure and recovery rules

- chain submission/receipt fail:
  - mark `CHAIN_FAILED`
  - release claim เมื่อยืนยันได้ว่า token ไม่ถูกส่ง
- chain confirmed แต่ DB commit fail:
  - mark `DB_FAILED` หรือ `MANUAL_REVIEW`
  - alert พร้อม operation ID และ tx hash
  - ห้าม retry blockchain transfer อัตโนมัติ
- stale `PREPARED`:
  - release ได้เมื่อไม่มี tx hash และผ่าน safety checks
- stale `SUBMITTED`:
  - query receipt ก่อนทุกครั้ง
  - ห้าม blind resend

ต้อง refactor blockchain adapter ให้เปิด tx hash ได้หลัง submit และก่อน wait
เพื่อเก็บสถานะ `SUBMITTED` อย่างถูกต้อง

#### B3.1 Manual recovery decision

Release B ใช้ manual recovery เท่านั้น ยังไม่มี cron:

- Admin ตรวจรายการทุกวันประมาณ 09:00 และหลัง deploy/incident
- `DB_FAILED` และ `MANUAL_REVIEW` แสดงเป็น `needsAction` ทันที
- `SUBMITTED` และ `PREPARED` แสดงเมื่อค้างเกิน 15 นาที
- recovery ต้อง query receipt และแก้เฉพาะ DB state/claim
- ห้าม recovery ส่ง blockchain transaction ซ้ำ
- generic execute ห้ามปล่อย `PREPARED`
- การปล่อย `PREPARED` ใช้ endpoint แยก ต้องเก่ากว่า 15 นาที
  และต้องส่งทั้ง reason กับ evidence
- ถ้า DB อยู่ใน partial/inconsistent state ให้คง claim ไว้และส่ง
  `MANUAL_REVIEW`
- ทุก dry-run/execute/release สร้าง `DirectTransferRecoveryRun`
  และ `DirectTransferOperationEvent`
- actor มาจาก Admin Basic Auth ที่ตรวจผ่านแล้ว ห้ามรับ actor จาก request body
- audit record เก็บไม่มีกำหนดในรอบแรก

Admin API:

```text
GET  /admin/direct-transfer-recovery/operations
POST /admin/direct-transfer-recovery/dry-run
POST /admin/direct-transfer-recovery/execute
POST /admin/direct-transfer-recovery/operations/:operationId/release-prepared
```

ข้อมูลเก่าก่อน Release B:

- ไม่สร้าง operation ย้อนหลัง
- ไม่ backfill `sourcePool`
- ไม่เข้า recovery flow นี้
- คงเป็น legacy/unclassified และใช้ repair plan แยกหากต้องแก้ภายหลัง

### B4. Tests

- concurrent operations ไม่ claim Voucher Code ซ้ำ
- insufficient rows ไม่สร้าง partial reservation
- chain failure release claim อย่างปลอดภัย
- confirmed chain + DB failure เข้า manual review และไม่ส่งเชนซ้ำ
- retry/recovery ตรวจ receipt ก่อน
- new Direct Transfer transaction เป็น `WALLET_POOL` 100%
- Marketplace purchase transaction เป็น `ACTIVE_MARKETPLACE_POOL` 100%
- Direct Transfer ไม่สร้าง Point payment และไม่เขียน `pointId`
- Redeem ใช้ `Voucher.merchantRef` เทียบ request และเขียน
  `Transaction.merchantRef` โดยไม่พึ่ง Point
- legacy transaction receiver ยัง resolve เหมือนเดิมโดยไม่ถูกใช้แทนร้าน C
- migration ใช้กับ snapshot schema ปัจจุบันได้

### B5. Deployment

1. Backup และตรวจ migration plan
2. Deploy additive migration
3. Deploy application
4. Smoke test operation lifecycle บน staging
5. Deploy production
6. Monitor operation ที่ค้างในทุก state

Rollback application ได้โดยคง nullable schema ไว้
ห้าม drop column/table ใน incident rollback

---

## 8. Phase 2 — Truthful on-chain balances

เริ่ม production verification หลัง Release A ขึ้นแล้ว
และใช้ immutable source metrics หลัง Release B

### P2-1. Chain reader

ต่อ merchant + ERC-1155 `typeId`:

- `onchainWallet = balanceOf(merchantWallet, typeId)`
- `marketplaceEscrow = balanceOf(marketplaceContract, typeId)`
- `activeListingAmount = sum(active on-chain listing amounts)`
- `escrowMismatch = marketplaceEscrow != activeListingAmount`
- ใช้ multicall/batch RPC เมื่ออ่านหลาย type
- คืน `asOf`, block number และ `stale`
- RPC fail:
  - คืน cached value พร้อม `stale=true` ถ้ามี
  - ห้าม fallback เป็น DB count แล้วแสดงเหมือนเป็น on-chain

### P2-2. API contract

เพิ่ม response fields โดยไม่เปลี่ยน Direct Transfer request:

```jsonc
{
  "onchainWallet": 8,
  "marketplaceEscrow": 31,
  "activeListingAmount": 31,
  "escrowMismatch": false,
  "eligibleWalletRows": 21,
  "directTransferableNow": 8,
  "transferFromWalletPoolConfirmed": 23,
  "transferFromActivePoolConfirmed": 52,
  "legacyUnclassified": 75,
  "asOf": "2026-07-24T09:00:00Z",
  "blockNumber": 123456,
  "stale": false
}
```

ข้อกำหนด:

- `eligibleWalletRows` ใช้ shared eligibility เดียวกับ Release A/B
- `directTransferableNow = min(onchainWallet, eligibleWalletRows)`
- lifecycle/dashboard query ใช้ ownership + `isUsed` + listing/reservation
  และห้ามใช้ `pointId` เป็นตัวแบ่ง `upcoming`/`active`
- ข้อมูลเก่ายังอยู่ใน `total`, `sold`, `unsold`, `unredeemed`, `redeemed`
  ตาม ownership โดยไม่ต้อง backfill
- historical 23/52 จาก audit ใช้เป็น evidence/report ได้
  แต่ห้ามคืนเป็น confirmed API metric จนกว่าจะมี immutable `sourcePool`
- `soldToCustomerCount` ต้องมีนิยามเดียวใน admin/merchant dashboard
- UI action ต้อง validate กับ `directTransferableNow`

### P2-3. Health check job

ตรวจราย `typeId`:

```text
liveSupply = minted - redeemed
expectedDistribution = merchantWallets + marketplaceEscrow + customerWallets
```

- diff หรือ escrow mismatch ให้ alert แบบ report-only
- ใส่ merchant, voucher, typeId, block number และค่าทุกฝั่ง
- ห้าม auto-fix
- known historical mismatch ใช้ suppression ที่มี owner, reason และ expiry
  ห้าม ignore แบบถาวร

ก่อนเปิด production job ต้องขอ D5

### P2-4. Dev/test wallet exclusion

- ใช้ config allowlist
- แยกยอด internal/test ออกจากยอดธุรกิจ
- ไม่ลบออกจาก supply reconciliation โดยไม่มีคำอธิบาย

งานนี้ block จนกว่า owner ยืนยัน D3

### P2-5. Cache

- ค่าเสนอ TTL = 60 วินาที
- cache key ต้องรวม chain, contract, merchant wallet และ typeId
- ทุก response มี `asOf`, block number และ stale status

ต้องยืนยัน D4 ก่อนล็อก production config

### P2-6. UI

แสดงอย่างน้อย:

- กระเป๋าร้านบนเชน
- ฝากขายใน Marketplace escrow
- โอนตรงได้ตอนนี้
- ขาย/ส่งให้ลูกค้าแล้ว
- timestamp และ stale state

ห้ามรวม merchant wallet + marketplace escrow แล้วใช้ชื่อกำกวมว่า “Market Wallet”

### P2-7. Tests and rollout

- API ตรงกับ `balanceOf` ที่ block เดียวกัน
- active listing sum และ mismatch flag ถูกต้อง
- inactive listing ไม่ถูกนับ
- cache TTL/stale behavior ถูกต้อง
- `directTransferableNow` ใช้ min ของสองแหล่ง
- legacy rows แสดงเป็น unclassified
- staging เทียบกับ production investigation snapshot
- production rollout มี D2 communication

---

## 9. Definition of Done

| ข้อ | เกณฑ์ |
|---|---|
| 1 | Direct Transfer ใหม่ที่ผูก Marketplace listing ไม่เพิ่มหลัง deploy 14 วัน |
| 2 | Direct Transfer ใหม่ไม่ lookup/set `pointId` และ Coupon ที่ไม่มี Point redeem ได้ |
| 3 | concurrent Direct Transfer ไม่ claim Voucher Code ซ้ำ |
| 4 | transaction ใหม่ทุก flow มี immutable `sourcePool` ถูกต้อง |
| 5 | historical source ที่พิสูจน์ไม่ได้แสดงเป็น `legacyUnclassified` |
| 6 | `fixOnchain`, mutating sync และ backfill execute ถูกปิด |
| 7 | ยอด merchant wallet/escrow ที่แสดงตรงกับ on-chain block ที่ระบุ |
| 8 | `directTransferableNow` เท่ากับ min(on-chain wallet, eligible rows) |
| 9 | reconciliation job เป็น report-only และส่ง alert ตาม owner ที่ยืนยัน |
| 10 | merchant/wallet ถูก resolve ก่อน on-chain redeem ทุกครั้ง |
| 11 | Dashboard รักษา total/sold และ sold/redeemed invariants สำหรับข้อมูลเก่าและใหม่ |
| 12 | targeted tests, migration validation และ build ผ่านก่อน production |

## 10. งานที่ไม่อยู่ในแผนนี้

- ซ่อม 52 historical transfers ที่สัมพันธ์กับ Marketplace
- backfill `pointId` ให้ historical Direct Transfer
- backfill `Transaction.merchantRef` โดยเดาจาก Point, Coupon owner หรือ Marketer
- mint/burn/transfer token เพื่อให้ DB กับ chain เท่ากัน
- backfill `sourcePool` ด้วย heuristic
- เปลี่ยน smart contract
- เปลี่ยน Direct Transfer request payload
- redesign voucher status enum ทั้งระบบ
- full event indexer

งานเหล่านี้ต้องมี Phase 3 repair proposal, dry-run evidence, rollback/compensation
และ owner approval แยกต่างหาก

## 11. Documentation updates ระหว่าง implementation

- แก้ข้อความใน `DIRECT_TRANSFER_QUERIES.md` ที่อธิบาย Marketplace เป็น
  approve-and-pull ให้ตรงกับ escrow/listing flow จริง
- อัปเดต `problem.md` เฉพาะ status/evidence หลัง deploy
  ห้ามแก้ historical evidence เดิม
- commit diagnostic scripts เฉพาะตัวที่ผ่านการตรวจ secret, environment guard
  และยืนยันว่า default เป็น read-only

## 12. Review gates

ก่อนเริ่ม implement ให้ owner review:

1. ขอบเขต Release A → Release B
2. D1: Direct Transfer ทุก currency ไม่รับ/resolve/set `pointId`
   และ Point ไม่ block redemption
3. การปิดทั้ง `fixOnchain` และ mutating `sync`
4. Historical data เป็น report-only และ `legacyUnclassified`
5. Release A คง Point-first legacy resolver เพื่อไม่เปลี่ยน receiver เดิม
   แต่ receiver ไม่ใช่ร้าน C และย้าย merchant/wallet resolution มาไว้ก่อน
   on-chain burn
6. ร้าน C มาจาก `Voucher.merchantRef` และ request ต้องกรอกค่าเดียวกัน
7. ไม่ตรวจ `MerchantRefStore.isActive` ตอน Redeem
8. ไม่เพิ่ม `redemptionMerchantId`; ใช้ `Transaction.merchantRef` เดิม

ข้อ 1-8 สะท้อนการตัดสินใจที่คุยกับ owner แล้วในวันที่ 2026-07-24
เมื่อได้ final implementation approval ทีมเริ่ม Release A ได้ทันที
โดยยังไม่ต้องรอ D3-D5
