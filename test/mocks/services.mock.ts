/**
 * Mock Services Factory
 * Creates mock instances of services for testing
 */

/**
 * Create mock TransactionDBService
 */
export const createMockTransactionDBService = () => ({
  getTransactionsByCustomerId: jest.fn(),
  getAllTransactionsByCustomerId: jest.fn(),
  getTransactionsByMerchantId: jest.fn(),
  createTransaction: jest.fn(),
});

/**
 * Create mock CustomerDBService
 */
export const createMockCustomerDBService = () => ({
  getCustomerByPhoneDetailed: jest.fn(),
  getCustomersByPhone: jest.fn(),
  getCustomerById: jest.fn(),
  createCustomer: jest.fn(),
  updateCustomer: jest.fn(),
});

/**
 * Create mock BlockchainService
 */
export const createMockBlockchainService = () => ({
  getBalance: jest.fn(),
  transfer: jest.fn(),
  mint: jest.fn(),
  burn: jest.fn(),
  getTransactionReceipt: jest.fn(),
});

/**
 * Create mock VoucherDBService
 */
export const createMockVoucherDBService = () => ({
  getVoucherById: jest.fn(),
  getVouchersByMerchantId: jest.fn(),
  createVoucher: jest.fn(),
  activateVoucher: jest.fn(),
  redeemVoucher: jest.fn(),
});

/**
 * Create mock MerchantDBService
 */
export const createMockMerchantDBService = () => ({
  getMerchants: jest.fn(),
  getAllMerchants: jest.fn(),
  getMerchantById: jest.fn(),
  createMerchant: jest.fn(),
  updateMerchant: jest.fn(),
  deleteMerchant: jest.fn(),
});

/**
 * Create mock PointDBService
 */
export const createMockPointDBService = () => ({
  getPointById: jest.fn(),
  getPointsByMerchantId: jest.fn(),
  createPoint: jest.fn(),
  updatePoint: jest.fn(),
  deletePoint: jest.fn(),
});

/**
 * Create mock SessionDBService
 */
export const createMockSessionDBService = () => ({
  createSession: jest.fn(),
  getSessionByToken: jest.fn(),
});

/**
 * Create mock TempLinkDBService
 */
export const createMockTempLinkDBService = () => ({
  createTempLink: jest.fn(),
  getTempLinkByUid: jest.fn(),
  getTempLinksByMerchant: jest.fn(),
  getTempLinkByPhoneNumber: jest.fn(),
  updateTempLink: jest.fn(),
  deleteTempLink: jest.fn(),
});

/**
 * Create mock WalletDBService
 */
export const createMockWalletDBService = () => ({
  getWalletByPhoneOrEmail: jest.fn(),
  getWalletById: jest.fn(),
  getWalletByCustomerId: jest.fn(),
  getWalletByMerchantId: jest.fn(),
  getWalletByAddress: jest.fn(),
  getCustomerByWalletAddress: jest.fn(),
  createWallet: jest.fn(),
  updateWallet: jest.fn(),
  getSellerWalletByMerchantId: jest.fn(),
});

/**
 * Create mock TokenService
 */
export const createMockTokenService = () => ({
  generateToken: jest.fn(),
  verifyToken: jest.fn(),
  decodeToken: jest.fn(),
});

/**
 * Create mock ConfigService
 */
export const createMockConfigService = (
  overrides: Record<string, any> = {},
) => {
  const config: Record<string, any> = {
    ENABLE_AUTH: true,
    FRONT_URL: 'http://localhost:3000',
    THB_ADDRESS: '0xTHB_TOKEN_ADDRESS',
    ...overrides,
  };
  return {
    get: jest.fn((key: string) => config[key]),
  };
};

/**
 * Create mock UserDBService
 */
export const createMockUserDBService = () => ({
  createUser: jest.fn(),
  getUserByEmail: jest.fn(),
});

/**
 * Create mock PrismaService
 */
export const createMockPrismaService = () => ({
  $transaction: jest.fn((fn: any) =>
    fn({
      merchant: { delete: jest.fn(), create: jest.fn(), update: jest.fn() },
      wallet: { delete: jest.fn(), create: jest.fn() },
      customer: { findUnique: jest.fn(), create: jest.fn() },
      session: { create: jest.fn() },
    }),
  ),
  customer: { findUnique: jest.fn() },
  merchant: { findUnique: jest.fn() },
});
