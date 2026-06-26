# Improve Codebase — Coding Standard & Refactor Plan

เอกสารกำหนด standard และแผนปรับปรุง codebase สำหรับโปรเจ็ค merchant-backend
จัดทำเพื่อแก้ปัญหา code ที่ยังไม่มี pattern ชัดเจนใน Phase 1 ก่อนเดินหน้า Phase ถัดไป

---

## Tech Stack ปัจจุบัน

| ส่วน | เทคโนโลยี |
|---|---|
| Framework | NestJS 11 + Express |
| ภาษา | TypeScript 5.7 |
| Database | PostgreSQL ผ่าน Prisma 6 |
| Validation | class-validator / class-transformer + Joi (config) |
| Auth | Passport (custom strategy) + JWT + bcrypt |
| Blockchain | ethers.js v6 + @kiwarilabs/chidori-sdk |
| Testing | Jest 30 + ts-jest |
| Tooling | ESLint 8, Prettier 3, Husky, Yarn 1 |

## ปัญหาหลักที่พบในโค้ดปัจจุบัน

1. **ชื่อไฟล์ 3 สไตล์ปนกัน**: `src/libs/createWallet.ts` (camelCase),
   `src/libs/derive-wallet.ts` (kebab-case), `src/repository/PrismaRepository.ts` (PascalCase)
2. **Error เป็น magic string**: `'404001: User not found'` ใน `src/errors/error.constants.ts`
   — client ต้อง parse string, ไม่มี type safety
3. **ปิด `no-explicit-any`** ใน `.eslintrc.js` และโค้ดใช้จริง เช่น
   `(merchant as any).wallet?.walletAddress` ใน `createPoint.handler.ts`
4. **Bug ด้าน security ใน `src/main.ts`**: อ่าน `CORS_ORIGINS` จาก config แล้วไม่ได้ใช้ —
   ใช้ `origin: '*'` คู่กับ `credentials: true` (combination ที่ spec ไม่อนุญาตและอันตราย),
   port hardcode `4000`
5. **ไม่มี API versioning**, test อยู่ใน `test/` แบบ flat แยกจาก source,
   Prisma schema ใช้ `String` + comment แทน enum

---

## ลำดับความสำคัญ (ทำอะไรก่อน-หลัง)

| ลำดับ | หัวข้อ | เหตุผล |
|---|---|---|
| 1 | Linter/Formatter (ข้อ 3) | เป็น **guardrail อัตโนมัติ** — ตั้งครั้งเดียวบังคับ standard ที่เหลือได้ ไม่ต้องพึ่งวินัยคน |
| 2 | Security fix เร่งด่วน (ข้อ 9) | CORS bug เป็นช่องโหว่จริงใน production แก้ได้ใน 10 นาที |
| 3 | Error Handling + API format (ข้อ 4, 5) | เป็น **สัญญากับ client** — ยิ่งปล่อยนาน frontend ยิ่งผูกกับ format เดิม แก้ทีหลังคือ breaking change |
| 4 | Naming Convention (ข้อ 1) | หยุด entropy ใหม่ทันที ของเก่าทยอย rename ตอนแตะไฟล์ |
| 5 | Type Safety / DTO (ข้อ 6) | เปิด `no-explicit-any` กลับมา ลด bug ที่ compiler จับให้ได้ฟรี |
| 6 | Project Structure (ข้อ 2) | โครงปัจจุบันใช้ได้แล้ว แค่เขียน rule ให้ชัด ไม่ใช่งานรื้อ |
| 7 | Database/Repository (ข้อ 7) | Prisma enum + migration convention |
| 8 | Testing (ข้อ 8) | ย้าย test มา colocate + วาง convention |
| 9 | Git/Collaboration (ข้อ 10) | สำคัญแต่ทีมเล็กยังพอคุยกันได้ ทำเป็นลายลักษณ์อักษรท้ายสุด |

> หลักคิด: **เริ่มจากสิ่งที่เครื่องบังคับได้ → สิ่งที่แก้ทีหลังแพง (API contract) → สิ่งที่ทยอยทำได้ (naming, structure)**

---

## 1. Naming Convention

### ชื่อไฟล์

**กฎหลัก: kebab-case + suffix บอกชนิด** (ตาม NestJS convention ซึ่งโปรเจ็คใช้อยู่แล้วเกินครึ่ง)

```
✅ create-point.handler.ts      ❌ createPoint.handler.ts
✅ derive-wallet.ts             ✅ (อันนี้ถูกอยู่แล้ว)
✅ prisma.repository.ts         ❌ PrismaRepository.ts
✅ point-db.service.ts
✅ transaction-types.enum.ts
```

Suffix ที่ใช้: `.module.ts` `.controller.ts` `.service.ts` `.handler.ts` `.repository.ts`
`.dto.ts` `.guard.ts` `.decorator.ts` `.interceptor.ts` `.filter.ts` `.strategy.ts`
`.enum.ts` `.type.ts` `.constants.ts` `.spec.ts`

### ตัวแปร / ฟังก์ชัน / class

```typescript
// ตัวแปร: camelCase, ชื่อบอกความหมาย ไม่ย่อ
const merchantWalletAddress = ...;   // ✅
const mwAddr = ...;                  // ❌

// boolean ขึ้นต้น is/has/can/should
const isExpired = endDate < new Date();
const hasWallet = !!merchant.walletId;

// ค่าคงที่ระดับ module: UPPER_SNAKE_CASE
const DEFAULT_EPOCH_DURATION_SECONDS = 259_200;

// ฟังก์ชัน: camelCase, ขึ้นต้นด้วย verb
function deriveWalletFromSeed(seed: string): Wallet {}
async function findPointsByMerchantId(merchantId: string): Promise<Point[]> {}

// Class: PascalCase + suffix บอก role
// Handler class ตั้งชื่อเต็มเป็น verb phrase + suffix Handler
export class CreatePointHandler {}   // ✅ (ปัจจุบันชื่อ CreatePoint เฉย ๆ — ชนกับชื่อ DTO/type ง่าย)

// Interface/Type: PascalCase ไม่ใส่ I นำหน้า
export interface PaginatedResult<T> {}  // ✅
export interface IPointService {}       // ❌

// Enum: PascalCase, member เป็น UPPER_SNAKE (เลือกอย่างเดียวทั้งโปรเจ็ค)
export enum WalletType {
  MASTER = 'master',
  MERCHANT = 'merchant',
  SELLER = 'seller',
  CUSTOMER = 'customer',
}
```

### วิธี migrate ของเก่า

ไม่ rename ทีเดียวทั้งโปรเจ็ค (PR ระเบิด, conflict กับงานคนอื่น) —
ใช้กฎ **"แตะไฟล์ไหน rename ไฟล์นั้น"** และใช้ `git mv` เพื่อรักษา history

---

## 2. Project Structure & Architecture Pattern

โครงปัจจุบันคือ **Layered + Use-case Handler (CQRS-lite)** ซึ่งเหมาะกับโปรเจ็คนี้แล้ว —
Clean/Hexagonal เต็มรูปแบบจะ over-engineer สำหรับ backoffice ระดับนี้
สิ่งที่ต้องทำคือเขียนกฎให้ชัดว่าแต่ละชั้นทำอะไร

### โครงสร้างโฟลเดอร์เป้าหมาย

```
src/
├── main.ts
├── app.module.ts
├── config/                      # configSchema.ts ย้ายมารวมที่นี่
├── common/                      # ของที่ทุก module ใช้: interceptor, filter, pipe, dto กลาง
│   ├── dtos/
│   ├── filters/                 # http-exception.filter.ts ย้ายมาจาก src/filters
│   └── interceptors/
├── errors/                      # error catalog + custom exception
├── libs/                        # pure function ไม่มี dependency กับ Nest (เช่น derive-wallet)
├── providers/                   # gateway ออกนอกระบบ: blockchain, otp, admd, ais-transfer
│   └── blockchain/
│       ├── blockchain.module.ts
│       ├── blockchain.service.ts
│       ├── abis/
│       └── types/
└── modules/
    ├── internal/                # API หลังบ้าน (ต้อง login)
    │   └── point/
    │       ├── point.module.ts
    │       ├── point.repository.ts   # ชั้นเดียวที่คุย Prisma
    │       ├── controllers/          # รับ HTTP, validate, เรียก handler — ห้ามมี logic
    │       ├── handlers/             # 1 ไฟล์ = 1 use case = 1 class + execute()
    │       ├── services/             # logic ที่หลาย handler ใช้ร่วมกัน
    │       ├── dtos/
    │       └── types/
    ├── external/                # API ให้ partner (api-key auth)
    └── shared/
```

### กฎการพึ่งพา (dependency rule) — สำคัญกว่าผังโฟลเดอร์

```
Controller → Handler → Service / Repository / Provider
```

- Controller **ห้าม** เรียก Repository/Prisma ตรง
- Handler **ห้าม** เรียก handler ของต่าง module ตรง ๆ
  (ปัจจุบัน `CreatePointHandler` inject `GetMerchant` จาก merchant module ตรง ๆ —
  ให้ merchant module export เป็น `MerchantService` แล้ว inject service แทน
  เพื่อให้ boundary ระหว่าง module ชัด)
- `libs/` ต้องเป็น pure function ที่ test ได้โดยไม่ต้องมี Nest

---

## 3. Coding Style & Convention

### .prettierrc

```json
{
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "semi": true,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

### .eslintrc.js — เลิกปิด rule ที่ปิดอยู่

```javascript
rules: {
  '@typescript-eslint/no-explicit-any': 'warn',        // เปิดกลับ (warn ก่อน → error ใน 1 เดือน)
  '@typescript-eslint/explicit-function-return-type': ['warn', {
    allowExpressions: true,
  }],
  '@typescript-eslint/no-floating-promises': 'error',  // จับ async ที่ลืม await — บัคยอดฮิตใน Nest
  '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  'no-console': 'error',                               // บังคับใช้ Logger เท่านั้น
}
```

### Husky + lint-staged

ปัจจุบัน pre-commit รันแค่ prettier — เพิ่ม lint ผ่าน `lint-staged`:

```json
// package.json
"lint-staged": {
  "*.ts": ["eslint --fix", "prettier --write"]
}
```

### Comment & Documentation Standard

- เขียน comment เฉพาะ **"ทำไม"** ไม่ใช่ "ทำอะไร" —
  เช่น `// ส่ง response ตามที่ exception กำหนดไว้` ใน filter ปัจจุบันคือ noise ที่ไม่ต้องมี
- ภาษา: ใช้ภาษาเดียวทั้งโปรเจ็ค (แนะนำอังกฤษ — ตอนนี้ comment ใน schema.prisma ไทย/อังกฤษปน)
- Public API ของ service/handler ใช้ JSDoc สั้น ๆ เมื่อ behavior ไม่ตรงไปตรงมา:

```typescript
/**
 * Derives a child wallet using BIP44. Increments the user's
 * nextDerivationIndex — caller must run inside a transaction.
 */
async deriveChildWallet(userId: string): Promise<Wallet> {}
```

---

## 4. API Design Standard

### Response envelope

มี `src/common/response.interceptor.ts` อยู่แล้ว ให้ fix format เป็นมาตรฐานเดียว:

```jsonc
// Success
{
  "statusCode": 200,
  "status": "success",
  "data": { ... }
}

// Success + pagination (ใช้ meta แยกจาก data เสมอ)
{
  "statusCode": 200,
  "status": "success",
  "data": [ ... ],
  "meta": { "page": 1, "limit": 20, "totalItems": 153, "totalPages": 8 }
}

// Error (ดูข้อ 5)
{
  "statusCode": 404,
  "status": "error",
  "errorCode": "POINT_NOT_FOUND",
  "message": "Point not found"
}
```

### HTTP method & status code

| การกระทำ | Method + Path | Status |
|---|---|---|
| ดึง list | `GET /points` | 200 |
| ดึงรายตัว | `GET /points/:id` | 200 (ไม่เจอ → 404) |
| สร้าง | `POST /points` | 201 |
| แก้บางส่วน | `PATCH /points/:id` | 200 |
| ลบ | `DELETE /points/:id` | 204 |
| Action พิเศษ | `POST /points/:id/send` | 200/202 |

Path ใช้ **พหูพจน์ kebab-case** (`/api-keys`, `/voucher-codes`) —
ห้ามมี verb ใน path ยกเว้น sub-action

### API Versioning

ตอนนี้ยังไม่มี — ใส่ตอน Phase 1 ถูกที่สุด ใช้ URI versioning ที่ Nest มี built-in:

```typescript
// main.ts
app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
// → ทุก route กลายเป็น /v1/... โดย controller เดิมไม่ต้องแก้
```

### Input validation

มี ValidationPipe + `whitelist` แล้ว — เพิ่ม `forbidNonWhitelisted: true` และมาตรฐาน DTO:

```typescript
export class CreatePointDto {
  @ApiProperty({ example: 'AIS Point' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 1_000_000 })
  @IsInt()
  @Min(1)
  initialSupply: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  imageUrl?: string;
}
```

กฎ: ทุก field ต้องมี validator + `@ApiProperty` (ได้ Swagger ฟรี),
ทุก query pagination ใช้ `PaginationDto` กลางจาก `src/common/dtos/pagination.dto.ts`

---

## 5. Error Handling

### ปัญหาปัจจุบัน

Error code ฝังใน string `'404001: User not found'` — client ต้อง parse string,
ไม่มี type safety, และ handler แต่ละตัว try/catch + log เองซ้ำซ้อน

### แบบใหม่ — error catalog เป็น object

```typescript
// src/errors/error-catalog.ts
export interface ErrorDef {
  status: number;
  code: string;
  message: string;
}

export const Errors = {
  USER_NOT_FOUND: { status: 404, code: 'USER_NOT_FOUND', message: 'User not found' },
  MERCHANT_NOT_FOUND: { status: 404, code: 'MERCHANT_NOT_FOUND', message: 'Merchant not found' },
  INVALID_CREDENTIALS: { status: 401, code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' },
  MERCHANT_WALLET_NOT_CONFIGURED: {
    status: 400,
    code: 'MERCHANT_WALLET_NOT_CONFIGURED',
    message: 'Merchant wallet not configured',
  },
  RPC_SERVER_ERROR: { status: 502, code: 'RPC_SERVER_ERROR', message: 'Blockchain RPC error' },
} as const satisfies Record<string, ErrorDef>;
```

```typescript
// src/errors/app.exception.ts
export class AppException extends HttpException {
  constructor(error: ErrorDef, detail?: string) {
    super(
      {
        statusCode: error.status,
        status: 'error',
        errorCode: error.code,
        message: detail ?? error.message,
      },
      error.status,
    );
  }
}

// การใช้ใน handler — สั้นและ type-safe
throw new AppException(Errors.MERCHANT_WALLET_NOT_CONFIGURED);
```

### กฎ try/catch

Handler **ไม่ต้อง** try/catch ครอบทั้งฟังก์ชันแบบปัจจุบัน —
ปล่อยให้ `http-exception.filter.ts` (ซึ่งทำงานดีอยู่แล้ว) จัดการ log + format ที่จุดเดียว
จะ catch เฉพาะเมื่อจะ **แปลง** error (เช่น ethers error → `Errors.RPC_SERVER_ERROR`)
หรือ **กู้คืน** ได้จริง

### Logging strategy

```typescript
private readonly logger = new Logger(CreatePointHandler.name);

// Level:
//   error = ต้องมีคนดู
//   warn  = ผิดปกติแต่ระบบไปต่อ
//   log   = business event
//   debug = รายละเอียด dev
this.logger.log(`Point created: contract=${result.contractAddress} merchant=${merchantId}`);
```

- **ห้าม log**: password, seedPhrase, chainCode, private key, JWT, OTP,
  API key เต็ม ๆ (mask เป็น `ak_12ab****`)
- โปรเจ็คนี้มี seed phrase / HD wallet — field ต้องห้ามข้างบนถือเป็น hard rule
- เลิก prefix `[CreatePoint]` ในข้อความ เพราะ `Logger(CreatePointHandler.name)`
  ใส่ context ให้อยู่แล้ว

---

## 6. Interface & Type Safety

### แยก 3 ชั้นให้ชัด

```typescript
// 1. Entity = Prisma type — ใช้ภายใน server เท่านั้น ห้าม return ออก API ตรง ๆ
import { Point } from '@prisma/client';

// 2. DTO ขาเข้า = class + class-validator (ต้องเป็น class เพื่อให้ ValidationPipe ทำงาน)
export class CreatePointDto { ... }

// 3. Response model ขาออก = class + @ApiProperty + static factory
export class PointResponse {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() symbol: string;
  @ApiProperty() contractAddress: string;

  static fromEntity(point: Point): PointResponse {
    return {
      id: point.id,
      name: point.name,
      symbol: point.symbol,
      contractAddress: `0x${Buffer.from(point.contractAddress).toString('hex')}`,
    };
  }
}
```

เหตุผลที่ห้าม return entity ตรง ๆ: ตาราง `Wallet` มี `seedPhrase`, `chainCode` —
return entity ทั้งก้อนเท่ากับหลุด secret ทันทีที่ใครเผลอ include relation

### แก้ root cause ของ `as any`

ปัญหา `(merchant as any).wallet` เกิดเพราะ repository return type ไม่รู้จัก relation
ที่ include มา — ใช้ Prisma generated payload type:

```typescript
type MerchantWithWallet = Prisma.MerchantGetPayload<{ include: { wallet: true } }>;

async findWithWallet(id: string): Promise<MerchantWithWallet | null> {
  return this.prisma.merchant.findUnique({ where: { id }, include: { wallet: true } });
}
// → merchant.wallet?.walletAddress พิมพ์ได้เลย ไม่ต้อง cast
```

### interface vs type

- ใช้ `interface` กับ object shape ที่จะ implement/extend
- ใช้ `type` กับ union/utility เช่น `type WalletStatus = 'active' | 'suspended'`

---

## 7. Database & Data Access

### Repository pattern

มีอยู่แล้ว (`point.repository.ts` + `PrismaRepository`) — วางกฎ:

- Prisma client ถูกเรียกได้จาก `*.repository.ts` **เท่านั้น** — handler/service ห้ามแตะ
- Method ตั้งชื่อตามภาษา query: `findById`, `findManyByMerchantId`, `create`,
  `update`, `softDelete`
- Operation ที่ต้อง atomic ใช้ `$transaction` ใน repository:

```typescript
async createWithDerivation(userId: string, data: CreateWalletInput): Promise<Wallet> {
  return this.prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: userId },
      data: { nextDerivationIndex: { increment: 1 } },
    });
    return tx.wallet.create({
      data: { ...data, derivationIndex: user.nextDerivationIndex - 1 },
    });
  });
}
```

### Schema convention

ใช้ Prisma enum แทน String + comment:

```prisma
enum WalletType {
  MASTER
  MERCHANT
  SELLER
  CUSTOMER
}

model Wallet {
  type   WalletType   // ❌ เดิม: String // 'master', 'merchant', 'seller', 'customer'
  status WalletStatus
}
```

- Map ทุก field ใหม่เป็น snake_case ใน DB ให้สม่ำเสมอ
  (ตอนนี้ map แค่ `created_at`/`updated_at` แต่ `contractAddress` อยู่ใน DB เป็น camelCase) —
  ของเก่าต้อง migrate ค่อยทำ

### Migration convention

- ชื่อ = `<verb>_<what>` เช่น `add_voucher_code_table` (ที่ทำอยู่ดีแล้ว)
- **ห้าม** แก้ migration ที่ merge แล้ว
- Migration ต้อง deploy ได้โดยไม่ทำ data หาย — เพิ่ม column ใหม่ต้อง nullable หรือมี default

### Query optimization guideline

- List endpoint ต้องมี pagination เสมอ (`take`/`skip` + `orderBy` ชัดเจน)
- ใช้ `select` เมื่อไม่ต้องการทุก field โดยเฉพาะตารางที่มี secret
- ระวัง N+1 — ดึง relation ด้วย `include` ครั้งเดียวแทน loop query

---

## 8. Testing Standard

### โครงสร้าง

ย้าย unit test มา colocate กับ source (ปัจจุบันอยู่ `test/` แบบ flat 50+ ไฟล์
หาคู่กับ source ยาก):

```
src/modules/internal/point/handlers/
├── create-point.handler.ts
└── create-point.handler.spec.ts     # อยู่ติดกัน
test/
└── e2e/                             # เหลือเฉพาะ e2e
```

### Naming & structure

`describe` ตามชื่อ class/method, test name เป็นประโยค behavior:

```typescript
describe('CreatePointHandler', () => {
  describe('execute', () => {
    it('creates a point and deploys the contract to the merchant wallet', async () => {
      // Arrange
      const blockchain = createMock<BlockchainService>();
      blockchain.createNewPointToken.mockResolvedValue({ contractAddress: '0xabc' });
      // Act
      const result = await handler.execute('merchant-1', validDto());
      // Assert
      expect(result.contractAddress).toBe('0xabc');
    });

    it('throws MERCHANT_WALLET_NOT_CONFIGURED when merchant has no wallet', async () => {
      await expect(handler.execute('m-no-wallet', validDto()))
        .rejects.toMatchObject({ response: { errorCode: 'MERCHANT_WALLET_NOT_CONFIGURED' } });
    });
  });
});
```

### Mock / stub strategy

- Unit test ของ handler: mock repository/provider ผ่าน Nest
  `Test.createTestingModule` + `useValue`
- **Mock เฉพาะขอบระบบ** (Prisma, blockchain, OTP, HTTP ภายนอก) —
  ห้าม mock pure function ใน `libs/`
- สร้าง test fixture factory กลาง (`test/factories/point.factory.ts`)
  แทน copy object ก้อนใหญ่ในทุก spec

### Coverage target

handler + service + libs **≥ 80%** (ไม่นับ module/dto/main) —
ใส่ `coverageThreshold` ใน jest.config.js ให้ CI บังคับ

---

## 9. Security & Best Practices

### 🔴 แก้ทันที — `src/main.ts`

```typescript
// เดิม: อ่าน CORS_ORIGINS มาแล้วไม่ใช้, origin '*' + credentials true
const allowedOrigins = configService.get<string>('CORS_ORIGINS');
app.enableCors({ origin: '*', ..., credentials: true });

// ใหม่
app.enableCors({
  origin: configService.get<string>('CORS_ORIGINS')?.split(',') ?? [],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
});
await app.listen(configService.get<number>('PORT') ?? 4000);  // เลิก hardcode port
```

### Authentication / Authorization pattern

- ใช้ guard เป็น **global default + opt-out** ด้วย `@Public()`
  (มี `public.decorator.ts` แล้ว) — ปลอดภัยกว่า opt-in
  เพราะลืมใส่ guard = endpoint ยังถูกป้องกัน
- Authorization: เพิ่ม `@Roles()` decorator + `RolesGuard`
  เมื่อ admin/merchant มีสิทธิ์ต่างกัน

### Environment variable & secret management

- ทุก env var ต้องประกาศใน `configSchema.ts` (Joi) แบบ `required()` —
  app ต้อง **fail ตอน boot** ถ้า config ขาด ไม่ใช่พังกลางทาง
- `dev.env`/`docker.env` ใน repo ต้องมีแต่ค่า dummy —
  ตรวจว่าไม่มี secret จริง แล้วเพิ่ม `*.env` ใน `.gitignore` คู่กับ `dev.env.example`
- seedPhrase/chainCode เข้ารหัสก่อนเก็บ (ทำอยู่แล้ว) — กฎเพิ่ม:
  encryption key ต้องมาจาก env/KMS เท่านั้น และห้ามผ่าน log

### Input sanitization

- ValidationPipe + `whitelist` ป้องกัน mass assignment แล้ว,
  Prisma ป้องกัน SQL injection แล้ว
- Validate รูปแบบเข้ม: `@IsEthereumAddress()` (มีใน class-validator)
  ใช้กับทุก address input
- Rate-limit endpoint OTP/login ด้วย `@nestjs/throttler`

---

## 10. Git & Collaboration

### Branch naming

```
feature/point-expiry-epoch
fix/cors-origin-config
chore/rename-handler-files
hotfix/voucher-double-redeem
```

### Commit message — Conventional Commits

ของเดิมเช่น "update README", "del relist-batches" ไม่บอก why:

```
feat(point): add configurable epoch duration
fix(auth): reject expired session tokens
refactor(wallet): extract BIP44 derivation into libs
```

บังคับด้วย `commitlint` ใน husky `commit-msg` hook (มี husky อยู่แล้ว
เพิ่ม config นิดเดียว)

### PR / Code review guideline

- PR เล็ก (< ~400 บรรทัด diff), 1 PR = 1 เรื่อง —
  **ห้ามปน refactor/rename กับ feature** ใน PR เดียว ไม่งั้น review ไม่เห็น logic change
- PR description ต้องมี: ทำอะไร/ทำไม, วิธีทดสอบ,
  checklist (lint ผ่าน, test ผ่าน, ไม่มี secret)
- Review ภายใน 1 วันทำการ, ใช้ comment prefix `blocking:` / `nit:`
  ให้รู้ว่าอะไรต้องแก้ก่อน merge

---

## 11. หัวข้อเพิ่มเติมที่ควรมี

1. **Health check + graceful shutdown** — เพิ่ม `@nestjs/terminus`
   endpoint `/healthz` (เช็ค DB + RPC) และ `app.enableShutdownHooks()`
   เพื่อให้ container orchestrator ทำงานถูก
2. **CI pipeline** — pipeline ขั้นต่ำ: `lint → build → test → prisma migrate diff`
   ทุก PR; standard ทั้งหมดข้างบนไร้ค่าถ้า CI ไม่บังคับ
3. **Blockchain-specific standard** (เฉพาะโปรเจ็คนี้):
   - ทุก tx ต้องบันทึก `txHash` + status (`PENDING/CONFIRMED/FAILED`) ลง DB
     ก่อน confirm — เพื่อ reconcile ได้เมื่อ RPC ล่มกลางทาง
   - กำหนด confirmation block ขั้นต่ำเป็น constant เดียว
   - แยก "เงินใน DB" กับ "เงินบน chain" ชัดเจน และมี job reconcile
4. **API documentation** — แก้ Swagger description จาก `'The cats API'`
   และบังคับ `@ApiOperation`/`@ApiResponse` บนทุก endpoint
5. **CHANGELOG + ADR** — เพิ่ม `docs/adr/` บันทึกการตัดสินใจเชิงสถาปัตยกรรม
   (เช่น "ทำไมใช้ handler pattern", "ทำไมเก็บ seed phrase แบบ encrypted ใน DB")
   กัน 6 เดือนข้างหน้าไม่มีใครจำได้

---

## ขั้นต่อไปที่แนะนำ

PR แรก ๆ ควรเป็น:

1. แก้ CORS bug + port ใน `main.ts`
2. อัพเดต ESLint/Prettier/lint-staged config
3. สร้าง `AppException` + error catalog แล้ว migrate error constants

สามอย่างนี้จบใน 1–2 วันและให้ผลคุ้มสุด
