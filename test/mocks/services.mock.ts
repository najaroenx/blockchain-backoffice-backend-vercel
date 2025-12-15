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
