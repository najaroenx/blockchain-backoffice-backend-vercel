/**
 * Test Fixtures Index
 * Exports all test fixtures and utilities
 */

export { MockDataFactory } from './mock-data.factory';
export {
  createMockPrismaClient,
  createMockBlockchainService,
  createMockOtpService,
  createMockEncryptionService,
  createMockConfigService,
  createMockTokenService,
} from './prisma.mock';
export {
  createMockVoucherHandlers,
  createMockPointHandlers,
  createMockTransactionHandlers,
  createMockCustomerHandlers,
  createMockApiKeyHandlers,
  getVoucherHandlerProviders,
} from './handler-mocks.factory';
