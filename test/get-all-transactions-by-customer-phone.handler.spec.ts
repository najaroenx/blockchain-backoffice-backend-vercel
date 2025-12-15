import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { GetAllTransactionsByCustomerPhone } from '../src/modules/transaction/handlers/getAllTransactionsByCustomerPhone.handler';
import { TransactionDBService } from '../src/modules/transaction/services/transaction-db.service';
import { CustomerDBService } from '../src/modules/customer/services/customer-db.service';
import {
  createMockTransactionDBService,
  createMockCustomerDBService,
} from './mocks/services.mock';
import { MockDataFactory } from './fixtures/mock-data.factory';

describe('GetAllTransactionsByCustomerPhone', () => {
  let handler: GetAllTransactionsByCustomerPhone;
  let mockTransactionDB: ReturnType<typeof createMockTransactionDBService>;
  let mockCustomerDB: ReturnType<typeof createMockCustomerDBService>;

  const mockCustomer = MockDataFactory.createMockCustomer({
    id: 'customer-123',
    tel: '0987654321',
  });

  beforeEach(async () => {
    mockTransactionDB = createMockTransactionDBService();
    mockCustomerDB = createMockCustomerDBService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetAllTransactionsByCustomerPhone,
        {
          provide: TransactionDBService,
          useValue: mockTransactionDB,
        },
        {
          provide: CustomerDBService,
          useValue: mockCustomerDB,
        },
      ],
    }).compile();

    handler = module.get<GetAllTransactionsByCustomerPhone>(
      GetAllTransactionsByCustomerPhone,
    );

    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should return all transaction types (point + voucher)', async () => {
      const phone = '0987654321';

      const mockTransactions = [
        MockDataFactory.createMockTransactionWithRelations({
          id: 'tx-1',
          transactionTypeId: 'TRANSFER', // Point
        }),
        MockDataFactory.createMockTransactionWithRelations({
          id: 'tx-2',
          transactionTypeId: 'VOUCHER_TRANSFER', // Voucher
        }),
        MockDataFactory.createMockTransactionWithRelations({
          id: 'tx-3',
          transactionTypeId: 'MARKETPLACE_PURCHASE', // Point
        }),
        MockDataFactory.createMockTransactionWithRelations({
          id: 'tx-4',
          transactionTypeId: 'REDEEM', // Voucher
        }),
      ];

      mockCustomerDB.getCustomerByPhoneDetailed.mockResolvedValue(mockCustomer);
      mockTransactionDB.getAllTransactionsByCustomerId.mockResolvedValue(
        mockTransactions,
      );

      const result = await handler.execute(phone);

      expect(mockCustomerDB.getCustomerByPhoneDetailed).toHaveBeenCalledWith(
        phone,
      );
      expect(mockTransactionDB.getAllTransactionsByCustomerId).toHaveBeenCalledWith(
        'customer-123',
      );
      expect(result.transactions).toHaveLength(4);
    });

    it('should return transactions from all merchants', async () => {
      const phone = '0987654321';

      const mockTransactions = [
        MockDataFactory.createMockTransactionWithRelations({
          id: 'tx-merchant-1',
          merchantId: 'merchant-111',
          transactionTypeId: 'TRANSFER',
          merchant: {
            id: 'merchant-111',
            name: 'Merchant A',
            website: 'https://merchant-a.com',
          },
        }),
        MockDataFactory.createMockTransactionWithRelations({
          id: 'tx-merchant-2',
          merchantId: 'merchant-222',
          transactionTypeId: 'MINT',
          merchant: {
            id: 'merchant-222',
            name: 'Merchant B',
            website: 'https://merchant-b.com',
          },
        }),
        MockDataFactory.createMockTransactionWithRelations({
          id: 'tx-merchant-3',
          merchantId: 'merchant-333',
          transactionTypeId: 'VOUCHER_TRANSFER',
          merchant: {
            id: 'merchant-333',
            name: 'Merchant C',
            website: 'https://merchant-c.com',
          },
        }),
      ];

      mockCustomerDB.getCustomerByPhoneDetailed.mockResolvedValue(mockCustomer);
      mockTransactionDB.getAllTransactionsByCustomerId.mockResolvedValue(
        mockTransactions,
      );

      const result = await handler.execute(phone);

      expect(result.transactions).toHaveLength(3);
      expect((result.transactions[0] as any).merchantId).toBe('merchant-111');
      expect((result.transactions[1] as any).merchantId).toBe('merchant-222');
      expect((result.transactions[2] as any).merchantId).toBe('merchant-333');
    });

    it('should calculate direction correctly', async () => {
      const phone = '0987654321';

      const mockTransactions = [
        MockDataFactory.createMockTransactionWithRelations({
          id: 'tx-sent',
          transactionTypeId: 'TRANSFER',
          senderId: 'customer-123', // Customer is sender
          receiverId: 'customer-456',
        }),
        MockDataFactory.createMockTransactionWithRelations({
          id: 'tx-received',
          transactionTypeId: 'TRANSFER',
          senderId: 'merchant-123',
          receiverId: 'customer-123', // Customer is receiver
        }),
      ];

      mockCustomerDB.getCustomerByPhoneDetailed.mockResolvedValue(mockCustomer);
      mockTransactionDB.getAllTransactionsByCustomerId.mockResolvedValue(
        mockTransactions,
      );

      const result = await handler.execute(phone);

      expect(result.transactions[0].transactionDirection).toBe('SENT');
      expect(result.transactions[1].transactionDirection).toBe('RECEIVED');
    });

    it('should include voucher details for MARKETPLACE_PURCHASE', async () => {
      const phone = '0987654321';

      const mockTransactions = [
        MockDataFactory.createMockTransactionWithRelations({
          id: 'tx-marketplace',
          transactionTypeId: 'MARKETPLACE_PURCHASE',
          senderId: 'customer-123',
          receiverId: 'merchant-123',
          voucherCode: {
            id: 'code-123',
            voucher: {
              id: 'voucher-123',
              name: 'Test Voucher',
              valueType: 'cash',
              value: 100,
              imageUrl: 'https://example.com/voucher.png',
            },
          },
        }),
      ];

      mockCustomerDB.getCustomerByPhoneDetailed.mockResolvedValue(mockCustomer);
      mockTransactionDB.getAllTransactionsByCustomerId.mockResolvedValue(
        mockTransactions,
      );

      const result = await handler.execute(phone);

      expect((result.transactions[0] as any).voucher).toBeDefined();
      expect((result.transactions[0] as any).voucher.id).toBe('voucher-123');
      // voucherCodeId is in response but not in type definition
      expect((result.transactions[0] as any).voucherCodeId).toBeDefined();
    });

    it('should include voucher details for VOUCHER_TRANSFER and REDEEM', async () => {
      const phone = '0987654321';

      const mockTransactions = [
        MockDataFactory.createMockTransactionWithRelations({
          id: 'tx-voucher-transfer',
          transactionTypeId: 'VOUCHER_TRANSFER',
          voucherCode: {
            id: 'code-456',
            voucher: {
              id: 'voucher-456',
              name: 'Transfer Voucher',
              valueType: 'percent',
              value: 20,
              imageUrl: 'https://example.com/voucher2.png',
            },
          },
        }),
        MockDataFactory.createMockTransactionWithRelations({
          id: 'tx-redeem',
          transactionTypeId: 'REDEEM',
          voucherCode: {
            id: 'code-789',
            voucher: {
              id: 'voucher-789',
              name: 'Redeemed Voucher',
              valueType: 'free',
              value: 0,
              imageUrl: 'https://example.com/voucher3.png',
            },
          },
        }),
      ];

      mockCustomerDB.getCustomerByPhoneDetailed.mockResolvedValue(mockCustomer);
      mockTransactionDB.getAllTransactionsByCustomerId.mockResolvedValue(
        mockTransactions,
      );

      const result = await handler.execute(phone);

      expect((result.transactions[0] as any).voucher).toBeDefined();
      expect((result.transactions[0] as any).voucher.id).toBe('voucher-456');
      expect((result.transactions[1] as any).voucher).toBeDefined();
      expect((result.transactions[1] as any).voucher.id).toBe('voucher-789');
    });
  });

  describe('error handling', () => {
    it('should throw NotFoundException when customer not found', async () => {
      const phone = '0987654321';

      mockCustomerDB.getCustomerByPhoneDetailed.mockResolvedValue(null);

      await expect(handler.execute(phone)).rejects.toThrow(NotFoundException);
      await expect(handler.execute(phone)).rejects.toThrow(
        `Customer with phone ${phone} not found`,
      );
    });

    it('should handle empty transactions array', async () => {
      const phone = '0987654321';

      mockCustomerDB.getCustomerByPhoneDetailed.mockResolvedValue(mockCustomer);
      mockTransactionDB.getAllTransactionsByCustomerId.mockResolvedValue([]);

      const result = await handler.execute(phone);

      expect(result.transactions).toHaveLength(0);
      expect(result.counts).toBe(0);
    });
  });

  describe('response structure', () => {
    it('should return transactions with nested point object', async () => {
      const phone = '0987654321';

      const mockTransactions = [
        MockDataFactory.createMockTransactionWithRelations({
          id: 'tx-1',
          transactionTypeId: 'TRANSFER',
          point: {
            id: 'point-123',
            name: 'Test Points',
            symbol: 'TST',
            imageUrl: 'https://example.com/point.png',
          },
        }),
      ];

      mockCustomerDB.getCustomerByPhoneDetailed.mockResolvedValue(mockCustomer);
      mockTransactionDB.getAllTransactionsByCustomerId.mockResolvedValue(
        mockTransactions,
      );

      const result = await handler.execute(phone);

      expect((result.transactions[0] as any).point).toEqual({
        id: 'point-123',
        name: 'Test Points',
        symbol: 'TST',
        imageUrl: 'https://example.com/point.png',
      });
    });

    it('should return transactions with nested merchant object', async () => {
      const phone = '0987654321';

      const mockTransactions = [
        MockDataFactory.createMockTransactionWithRelations({
          id: 'tx-1',
          transactionTypeId: 'TRANSFER',
          merchant: {
            id: 'merchant-123',
            name: 'Test Merchant',
            website: 'https://test-merchant.com',
          },
        }),
      ];

      mockCustomerDB.getCustomerByPhoneDetailed.mockResolvedValue(mockCustomer);
      mockTransactionDB.getAllTransactionsByCustomerId.mockResolvedValue(
        mockTransactions,
      );

      const result = await handler.execute(phone);

      expect((result.transactions[0] as any).merchantId).toBe('merchant-123');
      expect((result.transactions[0] as any).merchantName).toBe('Test Merchant');
    });

    it('should return transactions with sender and receiver objects', async () => {
      const phone = '0987654321';

      const mockTransactions = [
        MockDataFactory.createMockTransactionWithRelations({
          id: 'tx-1',
          transactionTypeId: 'TRANSFER',
        }),
      ];

      mockCustomerDB.getCustomerByPhoneDetailed.mockResolvedValue(mockCustomer);
      mockTransactionDB.getAllTransactionsByCustomerId.mockResolvedValue(
        mockTransactions,
      );

      const result = await handler.execute(phone);

      expect((result.transactions[0] as any).sender).toHaveProperty('id');
      expect((result.transactions[0] as any).sender).toHaveProperty('walletAddress');
      expect((result.transactions[0] as any).sender).toHaveProperty('emailOrWebsite');
      expect((result.transactions[0] as any).receiver).toHaveProperty('id');
      expect((result.transactions[0] as any).receiver).toHaveProperty('walletAddress');
      expect((result.transactions[0] as any).receiver).toHaveProperty('emailOrWebsite');
    });

    it('should convert Buffer to hex string for txHash and addresses', async () => {
      const phone = '0987654321';

      const mockTransactions = [
        MockDataFactory.createMockTransactionWithRelations({
          id: 'tx-1',
          transactionTypeId: 'TRANSFER',
        }),
      ];

      mockCustomerDB.getCustomerByPhoneDetailed.mockResolvedValue(mockCustomer);
      mockTransactionDB.getAllTransactionsByCustomerId.mockResolvedValue(
        mockTransactions,
      );

      const result = await handler.execute(phone);

      expect(typeof result.transactions[0].txHash).toBe('string');
      expect(result.transactions[0].txHash).toMatch(/^0x/);
      expect(typeof result.transactions[0].senderAddress).toBe('string');
      expect(result.transactions[0].senderAddress).toMatch(/^0x/);
      expect(typeof result.transactions[0].receiverAddress).toBe('string');
      expect(result.transactions[0].receiverAddress).toMatch(/^0x/);
    });

    it('should include counts in response', async () => {
      const phone = '0987654321';

      const mockTransactions = [
        MockDataFactory.createMockTransactionWithRelations({
          id: 'tx-1',
          transactionTypeId: 'TRANSFER',
        }),
        MockDataFactory.createMockTransactionWithRelations({
          id: 'tx-2',
          transactionTypeId: 'VOUCHER_TRANSFER',
        }),
        MockDataFactory.createMockTransactionWithRelations({
          id: 'tx-3',
          transactionTypeId: 'MINT',
        }),
      ];

      mockCustomerDB.getCustomerByPhoneDetailed.mockResolvedValue(mockCustomer);
      mockTransactionDB.getAllTransactionsByCustomerId.mockResolvedValue(
        mockTransactions,
      );

      const result = await handler.execute(phone);

      expect(result.counts).toBe(3);
      expect(result.transactions).toHaveLength(3);
    });
  });

  describe('mixed transaction types', () => {
    it('should handle mix of point and voucher transactions correctly', async () => {
      const phone = '0987654321';

      const mockTransactions = [
        MockDataFactory.createMockTransactionWithRelations({
          id: 'tx-1',
          transactionTypeId: 'TRANSFER', // Point
          senderId: 'merchant-123',
          receiverId: 'customer-123',
        }),
        MockDataFactory.createMockTransactionWithRelations({
          id: 'tx-2',
          transactionTypeId: 'VOUCHER_TRANSFER', // Voucher
          senderId: 'customer-123',
          receiverId: 'customer-456',
          voucherCode: {
            id: 'code-123',
            voucher: {
              id: 'voucher-123',
              name: 'Test Voucher',
              valueType: 'cash',
              value: 100,
              imageUrl: 'https://example.com/voucher.png',
            },
          },
        }),
        MockDataFactory.createMockTransactionWithRelations({
          id: 'tx-3',
          transactionTypeId: 'MARKETPLACE_PURCHASE', // Point with voucher info
          senderId: 'customer-123',
          receiverId: 'merchant-123',
          voucherCode: {
            id: 'code-456',
            voucher: {
              id: 'voucher-456',
              name: 'Purchased Voucher',
              valueType: 'percent',
              value: 20,
              imageUrl: 'https://example.com/voucher2.png',
            },
          },
        }),
      ];

      mockCustomerDB.getCustomerByPhoneDetailed.mockResolvedValue(mockCustomer);
      mockTransactionDB.getAllTransactionsByCustomerId.mockResolvedValue(
        mockTransactions,
      );

      const result = await handler.execute(phone);

      expect(result.transactions).toHaveLength(3);
      
      // Point transaction without voucher
      expect(result.transactions[0].transactionTypeId).toBe('TRANSFER');
      expect((result.transactions[0] as any).voucher).toBeNull();
      
      // Voucher transaction
      expect(result.transactions[1].transactionTypeId).toBe('VOUCHER_TRANSFER');
      expect((result.transactions[1] as any).voucher).toBeDefined();
      
      // Point transaction with voucher (marketplace purchase)
      expect(result.transactions[2].transactionTypeId).toBe('MARKETPLACE_PURCHASE');
      expect((result.transactions[2] as any).voucher).toBeDefined();
    });
  });
});
