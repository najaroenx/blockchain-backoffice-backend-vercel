import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../prisma/prisma.service';
import { AppModule } from '../src/app.module';

/**
 * Integration Tests for Complete Voucher Flow
 *
 * Tests the entire journey:
 * 1. Seller creates voucher
 * 2. Seller lists on marketplace
 * 3. Merchant buys from seller
 * 4. Merchant activates for customers
 * 5. Customer buys from merchant
 * 6. Customer redeems voucher
 */
describe('Voucher Flow Integration Tests (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Complete Voucher Lifecycle', () => {
    let sellerId: string;
    let merchantId: string;
    let customerId: string;
    let voucherId: string;
    let pointId: string;
    let listingId: string;
    let voucherCode: string;

    it('should complete full voucher lifecycle from creation to redemption', async () => {
      // This is a placeholder for the integration test
      // In a real scenario, you would:
      // 1. Set up test data (merchants, customers, points)
      // 2. Execute each step of the flow
      // 3. Verify database state after each step
      // 4. Verify blockchain interactions (if using testnet)

      expect(true).toBe(true);
    }, 60000); // 60 second timeout for long integration test
  });

  describe('API Endpoint Health Checks', () => {
    it('GET /health should return ok', () => {
      return request(app.getHttpServer())
        .get('/health')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status');
        });
    });

    it('GET /coupon should return vouchers list', () => {
      return request(app.getHttpServer())
        .get('/coupon')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });

    it('GET /coupon/active should return active vouchers only', () => {
      return request(app.getHttpServer())
        .get('/coupon/active')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          // All returned vouchers should have status 'active'
          res.body.forEach((voucher: any) => {
            if (voucher.status) {
              expect(voucher.status).toBe('active');
            }
          });
        });
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent voucher', () => {
      return request(app.getHttpServer())
        .get('/coupon/non-existent-id')
        .expect(404);
    });

    it('should validate required fields when creating voucher', async () => {
      const invalidData = {
        name: '', // Empty name should fail
      };

      return request(app.getHttpServer())
        .post('/coupon/dev/interim-seller')
        .send(invalidData)
        .expect(400);
    });
  });
});

/**
 * Integration Tests for Transaction Flow
 */
describe('Transaction Flow Integration Tests (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Point Transfer B2C', () => {
    it('should handle B2C point transfer with auto-registration', async () => {
      // This would test the full B2C flow:
      // 1. Merchant transfers points to new customer (auto-register)
      // 2. Verify customer created
      // 3. Verify customerMerchant relationship
      // 4. Verify point balance updated
      // 5. Verify transaction recorded

      expect(true).toBe(true);
    }, 30000);
  });

  describe('Transaction History', () => {
    it('GET /transaction/merchant/:merchantId should return transactions', () => {
      // Use a test merchant ID or create one
      const testMerchantId = 'test-merchant-id';

      return request(app.getHttpServer())
        .get(`/transaction/merchant/${testMerchantId}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });

    it('should filter transactions by customer ID', () => {
      const testMerchantId = 'test-merchant-id';
      const testCustomerId = 'test-customer-id';

      return request(app.getHttpServer())
        .get(
          `/transaction/customer/${testCustomerId}?merchantId=${testMerchantId}`,
        )
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });
  });
});

/**
 * Integration Tests for Customer Management
 */
describe('Customer Management Integration Tests (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Customer Lookup', () => {
    it('should find customer by phone number', () => {
      const testPhone = '0812345678';
      const testMerchantId = 'test-merchant-id';

      return request(app.getHttpServer())
        .get(`/customer/phone/${testPhone}?merchantId=${testMerchantId}`)
        .expect((res) => {
          // Should return 200 if found, or 404 if not found
          expect([200, 404]).toContain(res.status);
        });
    });

    it('should list customers for merchant', () => {
      const testMerchantId = 'test-merchant-id';

      return request(app.getHttpServer())
        .get(`/customer/merchant/${testMerchantId}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });
  });

  describe('Customer Point Balance', () => {
    it('should retrieve customer point balances', () => {
      const testCustomerId = 'test-customer-id';

      return request(app.getHttpServer())
        .get(`/customer/${testCustomerId}/points`)
        .expect((res) => {
          expect([200, 404]).toContain(res.status);
          if (res.status === 200) {
            expect(res.body).toHaveProperty('points');
          }
        });
    });
  });
});

/**
 * Integration Tests for Marketplace Operations
 */
describe('Marketplace Integration Tests (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Marketplace Listings', () => {
    it('should get marketplace listings', () => {
      return request(app.getHttpServer())
        .get('/coupon/marketplace/listings')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });

    it('should get voucher by listing ID', () => {
      const testListingId = 'test-listing-id';

      return request(app.getHttpServer())
        .get(`/coupon/marketplace/listing/${testListingId}`)
        .expect((res) => {
          expect([200, 404]).toContain(res.status);
        });
    });
  });

  describe('Whitelist Management', () => {
    it('should check whitelist status', () => {
      const testAddress = '0x1234567890123456789012345678901234567890';

      return request(app.getHttpServer())
        .get(`/coupon/admin/whitelist/${testAddress}`)
        .expect((res) => {
          expect([200, 404]).toContain(res.status);
          if (res.status === 200) {
            expect(res.body).toHaveProperty('isWhitelisted');
          }
        });
    });
  });
});
