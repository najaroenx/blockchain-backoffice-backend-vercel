/**
 * Prisma Mock Utilities
 * Provides mock Prisma client for testing
 */

export const createMockPrismaClient = () => ({
  merchant: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  customer: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  voucher: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  voucherCode: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
    groupBy: jest.fn(),
    count: jest.fn(),
  },
  point: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  transaction: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  customerMerChant: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  customerPoint: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  wallet: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  listingBatch: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  $transaction: jest.fn((callback) => {
    // Mock transaction callback
    if (typeof callback === 'function') {
      return callback({
        merchant: {
          findUnique: jest.fn(),
          findFirst: jest.fn(),
          findMany: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
          delete: jest.fn(),
        },
        customer: {
          findUnique: jest.fn(),
          findFirst: jest.fn(),
          findMany: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
          delete: jest.fn(),
        },
        voucher: {
          findUnique: jest.fn(),
          findFirst: jest.fn(),
          findMany: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
          delete: jest.fn(),
        },
        voucherCode: {
          findUnique: jest.fn(),
          findFirst: jest.fn(),
          findMany: jest.fn(),
          create: jest.fn(),
          createMany: jest.fn(),
          update: jest.fn(),
          deleteMany: jest.fn(),
          groupBy: jest.fn(),
          count: jest.fn(),
        },
        point: {
          findUnique: jest.fn(),
          findFirst: jest.fn(),
          findMany: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
          delete: jest.fn(),
        },
        transaction: {
          findUnique: jest.fn(),
          findFirst: jest.fn(),
          findMany: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
          delete: jest.fn(),
        },
        customerMerChant: {
          findUnique: jest.fn(),
          findFirst: jest.fn(),
          findMany: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
          delete: jest.fn(),
        },
        customerPoint: {
          findUnique: jest.fn(),
          findFirst: jest.fn(),
          findMany: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
          delete: jest.fn(),
        },
        listingBatch: {
          findUnique: jest.fn(),
          findFirst: jest.fn(),
          findMany: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
          delete: jest.fn(),
          count: jest.fn(),
        },
      });
    }
    return Promise.resolve();
  }),
  $connect: jest.fn(),
  $disconnect: jest.fn(),
});

/**
 * Create mock blockchain service
 */
export const createMockBlockchainService = () => ({
  getNFTBalance: jest.fn(),
  getBalance: jest.fn(),
  mintNFT: jest.fn(),
  transferNFT: jest.fn(),
  transferToken: jest.fn(),
  transaction: jest.fn(),
  createMarketplaceListing: jest.fn(),
  buyFromMarketplace: jest.fn(),
  addToWhitelist: jest.fn(),
  removeFromWhitelist: jest.fn(),
  isWhitelisted: jest.fn(),
  getMarketplaceListing: jest.fn(),
  getMarketplaceListings: jest.fn(),
  createNewPointToken: jest.fn(),
  redeemVoucher: jest.fn(),
  hasActiveVaultEscrow: jest.fn(),
  releaseVaultFundsPartial: jest.fn(),
  createCouponType: jest.fn(),
  mintCoupon: jest.fn(),
  listCoupon: jest.fn(),
  buyCoupon: jest.fn(),
  approveTHB: jest.fn(),
  mintTHB: jest.fn(),
  getUserCouponBalance: jest.fn(),
  getUserTHBBalance: jest.fn(), // Added for merchant buy tests
  addToMarketplaceWhitelist: jest.fn(),
});

/**
 * Create mock OTP service
 */
export const createMockOtpService = () => ({
  generateOtp: jest.fn(),
  verifyOtp: jest.fn(),
  sendOtp: jest.fn(),
});

/**
 * Create mock encryption service
 */
export const createMockEncryptionService = () => ({
  encrypt: jest.fn((value) => `encrypted-${value}`),
  decrypt: jest.fn((value) => {
    if (value && value.startsWith('encrypted-')) {
      return value.replace('encrypted-', '');
    }
    // Return a valid private key format for tests
    return '0x1234567890123456789012345678901234567890123456789012345678901234';
  }),
});

/**
 * Create mock config service
 */
export const createMockConfigService = () => ({
  get: jest.fn((key) => {
    const config = {
      ENCRYPTION_KEY: 'test-encryption-key',
      ENCRYPTION_IV: 'test-encryption-iv',
      JWT_SECRET: 'test-jwt-secret',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      BACKEND_PRIVATE_KEY: '0xtest-backend-private-key',
      THB_TOKEN_ADDRESS: '0xtest-thb-token-address',
      SALT: 'test-salt-12345678901234567890',
    };
    return config[key];
  }),
});

/**
 * Create mock token service
 */
export const createMockTokenService = () => ({
  sign: jest.fn(),
  verify: jest.fn(),
  decode: jest.fn(),
  decryptKey: jest.fn((salt, encryptedKey) => {
    // Return a valid private key format for tests
    if (encryptedKey) {
      return '0x1234567890123456789012345678901234567890123456789012345678901234';
    }
    return null;
  }),
});
