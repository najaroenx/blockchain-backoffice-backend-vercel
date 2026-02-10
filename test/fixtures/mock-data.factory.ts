/**
 * Mock Data Factory for Tests
 * Provides consistent test data across all test suites
 */

export const MockDataFactory = {
  /**
   * Create mock merchant with wallet
   */
  createMockMerchant: (overrides = {}) => ({
    id: 'merchant-123',
    name: 'Test Merchant',
    description: 'Test merchant description',
    website: 'https://test-merchant.com',
    tel: '0812345678',
    walletId: 'wallet-123',
    wallet: {
      id: 'wallet-123',
      walletAddress: '0x1234567890123456789012345678901234567890',
      privateKey: 'encrypted-private-key-123',
      seedPhrase: 'encrypted-merchant-seed-phrase',
      derivationIndex: 0,
      type: 'merchant',
      status: 'active',
    },
    ...overrides,
  }),

  /**
   * Create mock customer with wallet
   */
  createMockCustomer: (overrides = {}) => ({
    id: 'customer-123',
    email: 'test@customer.com',
    firstName: 'Test',
    lastName: 'Customer',
    tel: '0987654321',
    wallet: {
      id: 'wallet-customer-123',
      walletAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
      privateKey: 'encrypted-customer-key-123',
      seedPhrase: 'encrypted-customer-seed-phrase',
      derivationIndex: 0,
      type: 'customer',
      status: 'active',
    },
    customerMerChant: [],
    customerPoints: [],
    ownedVouchers: [],
    ...overrides,
  }),

  /**
   * Create mock voucher
   */
  createMockVoucher: (overrides = {}) => ({
    id: 'voucher-123',
    name: 'Test Voucher',
    description: 'Test voucher description',
    merchantId: 'merchant-123',
    tokenId: '12345',
    status: 'upcoming',
    valueType: 'cash',
    value: 100,
    startDate: new Date('2025-01-01'),
    endDate: new Date('2025-12-31'),
    totalIssued: 200,
    totalRedeemed: 0,
    imageUrl: 'https://example.com/voucher.jpg',
    merchantRef: 'REF-123',
    limitPerMember: 5,
    _count: {
      voucherCodes: 0,
    },
    ...overrides,
  }),

  /**
   * Create mock voucher code
   */
  createMockVoucherCode: (overrides = {}) => ({
    id: 'code-123',
    code: 'VOUCHER-0001',
    voucherId: 'voucher-123',
    voucherGroupId: 'listing-123',
    pointsCost: 100,
    pointId: 'point-123',
    currency: 'POINTS',
    isUsed: false,
    usedAt: null,
    currentOwnerId: null,
    createdAt: new Date(),
    voucher: null, // Can be populated if needed
    ...overrides,
  }),

  /**
   * Create mock point
   */
  createMockPoint: (overrides = {}) => ({
    id: 'point-123',
    name: 'Test Points',
    symbol: 'TST',
    merchantId: 'merchant-123',
    contractAddress: Buffer.from(
      '1234567890123456789012345678901234567890',
      'hex',
    ),
    imageUrl: 'https://example.com/point.png',
    ...overrides,
  }),

  /**
   * Create mock point with full relations (for handler responses)
   * Includes merchant and statistics required by GetPointById handler
   */
  createMockPointWithRelations: (overrides = {}) => ({
    id: 'point-123',
    name: 'Test Points',
    symbol: 'TST',
    merchantId: 'merchant-123',
    decimal: 18,
    initialSupply: 1000000,
    contractAddress: '0x1234567890123456789012345678901234567890',
    startDate: new Date('2025-01-01'),
    endDate: new Date('2025-12-31'),
    epochDuration: 259200,
    imageUrl: 'https://example.com/point.png',
    createdAt: new Date(),
    updatedAt: new Date(),
    merchant: {
      id: 'merchant-123',
      name: 'Test Merchant',
      description: null,
      imageUrl: null,
      website: null,
    },
    statistics: {
      totalTransactions: 0,
      totalCustomers: 0,
      totalBalance: 0,
      initialSupply: 1000000,
      circulatingSupply: 0,
    },
    ...overrides,
  }),

  /**
   * Create mock transaction
   */
  createMockTransaction: (overrides = {}) => ({
    id: 'tx-123',
    txHash: Buffer.from(
      'abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd',
      'hex',
    ),
    senderAddress: Buffer.from(
      '1234567890123456789012345678901234567890',
      'hex',
    ),
    receiverAddress: Buffer.from(
      'abcdefabcdefabcdefabcdefabcdefabcdefabcd',
      'hex',
    ),
    amount: 100,
    merchantId: 'merchant-123',
    pointId: 'point-123',
    senderId: null,
    receiverId: 'customer-123',
    transactionTypeId: 'TRANSFER',
    voucherCodeId: null,
    eventId: null,
    transactionRefId: 'ref-123',
    createdAt: new Date(),
    updatedAt: new Date(),
    // Relations for nested response
    point: null,
    sender: null,
    receiver: null,
    merchant: null,
    voucherCode: null,
    ...overrides,
  }),

  /**
   * Create mock transaction with full relations (for handler tests)
   */
  createMockTransactionWithRelations: (overrides = {}) => ({
    id: 'tx-123',
    txHash: Buffer.from(
      'abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd',
      'hex',
    ),
    senderAddress: Buffer.from(
      '1234567890123456789012345678901234567890',
      'hex',
    ),
    receiverAddress: Buffer.from(
      'abcdefabcdefabcdefabcdefabcdefabcdefabcd',
      'hex',
    ),
    amount: 100,
    merchantId: 'merchant-123',
    pointId: 'point-123',
    senderId: 'merchant-123',
    receiverId: 'customer-123',
    transactionTypeId: 'TRANSFER',
    type: 'POINT',
    senderType: 'MERCHANT',
    receiverType: 'CUSTOMER',
    voucherCodeId: null,
    eventId: null,
    transactionRefId: 'ref-123',
    createdAt: new Date('2025-12-11T10:00:00.000Z'),
    updatedAt: new Date('2025-12-11T10:00:00.000Z'),
    point: {
      id: 'point-123',
      name: 'Test Points',
      symbol: 'TST',
      imageUrl: 'https://example.com/point.png',
    },
    sender: {
      id: 'merchant-123',
      email: 'merchant@test.com',
      wallet: {
        walletAddress: '0x1234567890123456789012345678901234567890',
      },
    },
    receiver: {
      id: 'customer-123',
      email: 'customer@test.com',
      wallet: {
        walletAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
      },
    },
    merchant: {
      id: 'merchant-123',
      name: 'Test Merchant',
      website: 'https://test-merchant.com',
    },
    voucherCode: null,
    ...overrides,
  }),

  /**
   * Create mock marketplace listing
   */
  createMockMarketplaceListing: (overrides = {}) => ({
    listingId: 'listing-123',
    seller: '0x1234567890123456789012345678901234567890',
    typeId: '12345',
    amount: '100',
    pricePerUnit: '100',
    paymentToken: '0xPOINT_TOKEN_ADDRESS',
    isActive: true,
    listedAt: '1234567890',
    ...overrides,
  }),

  /**
   * Create mock blockchain balance response
   */
  createMockBalanceResponse: (overrides = {}) => ({
    balance: '1000',
    balanceWei: '1000000000000000000000',
    ...overrides,
  }),

  /**
   * Create mock blockchain transaction response
   */
  createMockBlockchainTx: (overrides = {}) => ({
    hash: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd',
    blockNumber: 12345,
    from: '0x1234567890123456789012345678901234567890',
    to: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
    value: '100000000000000000000',
    ...overrides,
  }),

  /**
   * Create mock NFT balance
   */
  createMockNFTBalance: (overrides = {}) => ({
    balance: '200',
    tokenId: '12345',
    ...overrides,
  }),

  /**
   * Create mock listing batch
   */
  createMockListingBatch: (overrides = {}) => ({
    id: 'batch-123',
    sellerWalletAddress: '0xf5e40ec8bfa4818278c04489b34a486281658e5c',
    name: 'Test Batch Listing',
    description: 'Test batch description',
    totalItems: 100,
    soldItems: 0,
    totalValue: 10000,
    currency: 'THB',
    status: 'ACTIVE',
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
    updatedAt: new Date('2025-01-01T00:00:00.000Z'),
    voucherCodes: [],
    ...overrides,
  }),

  /**
   * Create mock seller wallet
   */
  createMockSellerWallet: (overrides = {}) => ({
    id: 'wallet-seller-123',
    walletAddress: '0xf5e40ec8bfa4818278c04489b34a486281658e5c',
    privateKey: 'encrypted-seller-private-key-123',
    seedPhrase: 'encrypted-seller-seed-phrase',
    derivationIndex: 0,
    type: 'seller',
    status: 'active',
    ...overrides,
  }),

  /**
   * Create mock listing result from blockchain
   */
  createMockListingResult: (overrides = {}) => ({
    listingId: 'listing-456',
    hash: '0xabc123def456',
    blockNumber: 12345,
    ...overrides,
  }),
};
