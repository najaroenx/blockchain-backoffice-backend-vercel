/**
 * Handler Mocks Factory for Tests
 * Provides consistent mock handlers across all test suites
 * This ensures test isolation and makes it easy to add new handlers
 */

import { MockDataFactory } from './mock-data.factory';

/**
 * Create mock voucher handlers with default implementations
 */
export const createMockVoucherHandlers = () => ({
  // Voucher creation and management
  createVoucherWithCodes: {
    execute: jest.fn(),
  },
  activateVoucher: {
    execute: jest.fn(),
  },
  redeemVoucher: {
    execute: jest.fn(),
  },

  // Marketplace handlers
  buyCouponFromMarketplace: {
    execute: jest.fn(),
  },
  getMarketplaceListings: {
    execute: jest.fn(),
  },
  merchantBuyCouponFromSeller: {
    execute: jest.fn(),
  },
  sellerListOnMarketplace: {
    execute: jest.fn(),
  },

  // Query handlers
  getCustomerOwnedVouchers: {
    execute: jest.fn(),
  },
  getSellerVouchers: {
    execute: jest.fn(),
  },
  getVoucherById: {
    execute: jest.fn(),
  },
  getVoucherByListingId: {
    execute: jest.fn(),
  },
  getVoucherByMerchantRef: {
    execute: jest.fn(),
  },

  // Whitelist handler
  addToWhitelist: {
    execute: jest.fn(),
  },

  // Manage coupon handler
  manageCoupon: {
    updateVoucherCodesPointCost: jest.fn(),
    updateAllVoucherCodesPointCost: jest.fn(),
    getVoucherCodesStatistics: jest.fn(),
  },

  // ListingBatch handlers (NEW)
  batchListOnMarketplace: {
    execute: jest.fn(),
  },
  getSellerListings: {
    execute: jest.fn(),
  },
  getListingBatchDetail: {
    execute: jest.fn(),
  },
});

/**
 * Create mock point handlers with default implementations
 */
export const createMockPointHandlers = () => ({
  createPoint: {
    execute: jest.fn(),
  },
  getPointById: {
    execute: jest.fn().mockResolvedValue({
      point: MockDataFactory.createMockPointWithRelations(),
    }),
  },
  getPointsByMerchantId: {
    execute: jest.fn(),
  },
  updatePoint: {
    execute: jest.fn(),
  },
  deletePoint: {
    execute: jest.fn(),
  },
});

/**
 * Create mock transaction handlers
 */
export const createMockTransactionHandlers = () => ({
  createTransactionB2C: {
    execute: jest.fn(),
  },
  createTransactionC2C: {
    execute: jest.fn(),
  },
  burnTransaction: {
    execute: jest.fn(),
  },
  getTransactionsByCustomerId: {
    execute: jest.fn(),
  },
  getTransactionsByMerchantId: {
    execute: jest.fn(),
  },
  getMerchantBalance: {
    execute: jest.fn(),
  },
  getTreasuryBalance: {
    execute: jest.fn(),
  },
});

/**
 * Create mock customer handlers
 */
export const createMockCustomerHandlers = () => ({
  createCustomer: {
    execute: jest.fn(),
  },
  getCustomerById: {
    execute: jest.fn(),
  },
  getCustomerByPhone: {
    execute: jest.fn(),
  },
  clearCustomerByPhone: {
    execute: jest.fn(),
  },
});

/**
 * Create mock API key handlers
 */
export const createMockApiKeyHandlers = () => ({
  createApiKey: {
    execute: jest.fn(),
  },
  getApiKey: {
    execute: jest.fn(),
  },
  getApiKeys: {
    execute: jest.fn(),
  },
  deleteApiKey: {
    execute: jest.fn(),
  },
});

/**
 * Get provider config for voucher handlers (for use in TestingModule)
 * @example
 * const module = await Test.createTestingModule({
 *   providers: [
 *     ...getVoucherHandlerProviders(mocks),
 *   ],
 * }).compile();
 */
export const getVoucherHandlerProviders = (
  mocks: ReturnType<typeof createMockVoucherHandlers>,
) => {
  // Dynamic imports to avoid circular dependencies
  const CreateVoucherWithCodes =
    require('../../src/modules/voucher/handlers/createVoucherWithCodes.handler').CreateVoucherWithCodes;
  const ActivateVoucher =
    require('../../src/modules/voucher/handlers/activateVoucher.handler').ActivateVoucher;
  const RedeemVoucher =
    require('../../src/modules/voucher/handlers/redeemVoucher.handler').RedeemVoucher;
  const BuyCouponFromMarketplace =
    require('../../src/modules/voucher/handlers/buyCouponFromMarketplace.handler').BuyCouponFromMarketplace;
  const GetMarketplaceListings =
    require('../../src/modules/voucher/handlers/getMarketplaceListings.handler').GetMarketplaceListings;
  const MerchantBuyCouponFromSeller =
    require('../../src/modules/voucher/handlers/merchantBuyCouponFromSeller.handler').MerchantBuyCouponFromSeller;
  const SellerListOnMarketplace =
    require('../../src/modules/voucher/handlers/sellerListOnMarketplace.handler').SellerListOnMarketplace;
  const GetCustomerOwnedVouchers =
    require('../../src/modules/voucher/handlers/getCustomerOwnedVouchers.handler').GetCustomerOwnedVouchers;
  const GetSellerVouchers =
    require('../../src/modules/voucher/handlers/getSellerVouchers.handler').GetSellerVouchers;
  const GetVoucherById =
    require('../../src/modules/voucher/handlers/getVoucherById.handler').GetVoucherById;
  const GetVoucherByListingId =
    require('../../src/modules/voucher/handlers/getVoucherByListingId.handler').GetVoucherByListingId;
  const GetVoucherByMerchantRef =
    require('../../src/modules/voucher/handlers/getVoucherByMerchantRef.handler').GetVoucherByMerchantRef;
  const AddToWhitelist =
    require('../../src/modules/voucher/handlers/addToWhitelist.handler').AddToWhitelist;
  const ManageCouponHandler =
    require('../../src/modules/voucher/handlers/manageCoupon.handler').ManageCouponHandler;
  const BatchListOnMarketplaceHandler =
    require('../../src/modules/voucher/handlers/batchListOnMarketplace.handler').BatchListOnMarketplaceHandler;
  const GetSellerListingsHandler =
    require('../../src/modules/voucher/handlers/getSellerListings.handler').GetSellerListingsHandler;
  const GetListingBatchDetailHandler =
    require('../../src/modules/voucher/handlers/getListingBatchDetail.handler').GetListingBatchDetailHandler;

  return [
    { provide: CreateVoucherWithCodes, useValue: mocks.createVoucherWithCodes },
    { provide: ActivateVoucher, useValue: mocks.activateVoucher },
    { provide: RedeemVoucher, useValue: mocks.redeemVoucher },
    {
      provide: BuyCouponFromMarketplace,
      useValue: mocks.buyCouponFromMarketplace,
    },
    { provide: GetMarketplaceListings, useValue: mocks.getMarketplaceListings },
    {
      provide: MerchantBuyCouponFromSeller,
      useValue: mocks.merchantBuyCouponFromSeller,
    },
    {
      provide: SellerListOnMarketplace,
      useValue: mocks.sellerListOnMarketplace,
    },
    {
      provide: GetCustomerOwnedVouchers,
      useValue: mocks.getCustomerOwnedVouchers,
    },
    { provide: GetSellerVouchers, useValue: mocks.getSellerVouchers },
    { provide: GetVoucherById, useValue: mocks.getVoucherById },
    { provide: GetVoucherByListingId, useValue: mocks.getVoucherByListingId },
    {
      provide: GetVoucherByMerchantRef,
      useValue: mocks.getVoucherByMerchantRef,
    },
    { provide: AddToWhitelist, useValue: mocks.addToWhitelist },
    { provide: ManageCouponHandler, useValue: mocks.manageCoupon },
    {
      provide: BatchListOnMarketplaceHandler,
      useValue: mocks.batchListOnMarketplace,
    },
    { provide: GetSellerListingsHandler, useValue: mocks.getSellerListings },
    {
      provide: GetListingBatchDetailHandler,
      useValue: mocks.getListingBatchDetail,
    },
  ];
};
