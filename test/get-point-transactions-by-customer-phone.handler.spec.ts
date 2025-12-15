import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { GetPointTransactionsByCustomerPhone } from '../src/modules/transaction/handlers/getPointTransactionsByCustomerPhone.handler';
import { TransactionDBService } from '../src/modules/transaction/services/transaction-db.service';
import { CustomerDBService } from '../src/modules/customer/services/customer-db.service';
import {
  createMockTransactionDBService,
  createMockCustomerDBService,
} from './mocks/services.mock';
import { MockDataFactory } from './fixtures/mock-data.factory';

describe('GetPointTransactionsByCustomerPhone', () => {
  let handler: GetPointTransactionsByCustomerPhone;
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
        GetPointTransactionsByCustomerPhone,
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

    handler = module.get<GetPointTransactionsByCustomerPhone>(
      GetPointTransactionsByCustomerPhone,
    );

    jest.clearAllMocks();
  });

  describe('execute - merchant scoped', () => {
    it('should return point transactions filtered by merchantId', async () => {
      const merchantId = 'merchant-123';
      const phone = '0987654321';

      const mockTransactions = [
        MockDataFactory.createMockTransactionWithRelations({
          id: 'tx-1',
          transactionTypeId: 'TRANSFER',
          senderId: 'merchant-123',
          receiverId: 'customer-123',
        }),
        MockDataFactory.createMockTransactionWithRelations({
          id: 'tx-2',
          transactionTypeId: 'MINT',
          senderId: 'merchant-123',
          receiverId: 'customer-123',
        }),
        MockDataFactory.createMockTransactionWithRelations({
          id: 'tx-3',
          transactionTypeId: 'VOUCHER_TRANSFER', // Should be filtered out
          senderId: 'customer-123',
          receiverId: 'customer-456',
        }),
      ];

      mockCustomerDB.getCustomerByPhoneDetailed.mockResolvedValue(mockCustomer);
      mockTransactionDB.getTransactionsByCustomerId.mockResolvedValue(
        mockTransactions,
      );

      const result = await handler.execute(merchantId, phone);

      expect(mockCustomerDB.getCustomerByPhoneDetailed).toHaveBeenCalledWith(
        phone,
      );
      expect(
        mockTransactionDB.getTransactionsByCustomerId,
      ).toHaveBeenCalledWith('customer-123', merchantId);
      expect(result.transactions).toHaveLength(2); // Exclude VOUCHER_TRANSFER
      expect(result.transactions[0].transactionTypeId).toBe('TRANSFER');
      expect(result.transactions[1].transactionTypeId).toBe('MINT');
    });

    it('should include MARKETPLACE_PURCHASE in point transactions', async () => {
      const merchantId = 'merchant-123';
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
      mockTransactionDB.getTransactionsByCustomerId.mockResolvedValue(
        mockTransactions,
      );

      const result = await handler.execute(merchantId, phone);

      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].transactionTypeId).toBe(
        'MARKETPLACE_PURCHASE',
      );
      expect((result.transactions[0] as any).voucher).toBeDefined();
      expect((result.transactions[0] as any).voucher.id).toBe('voucher-123');
    });

    it('should calculate direction correctly - SENT', async () => {
      const merchantId = 'merchant-123';
      const phone = '0987654321';

      const mockTransactions = [
        MockDataFactory.createMockTransactionWithRelations({
          id: 'tx-sent',
          transactionTypeId: 'TRANSFER',
          senderId: 'customer-123', // Customer is sender
          receiverId: 'customer-456',
        }),
      ];

      mockCustomerDB.getCustomerByPhoneDetailed.mockResolvedValue(mockCustomer);
      mockTransactionDB.getTransactionsByCustomerId.mockResolvedValue(
        mockTransactions,
      );

      const result = await handler.execute(merchantId, phone);

      expect(result.transactions[0].transactionDirection).toBe('SENT');
    });

    it('should calculate direction correctly - RECEIVED', async () => {
      const merchantId = 'merchant-123';
      const phone = '0987654321';

      const mockTransactions = [
        MockDataFactory.createMockTransactionWithRelations({
          id: 'tx-received',
          transactionTypeId: 'TRANSFER',
          senderId: 'merchant-123',
          receiverId: 'customer-123', // Customer is receiver
        }),
      ];

      mockCustomerDB.getCustomerByPhoneDetailed.mockResolvedValue(mockCustomer);
      mockTransactionDB.getTransactionsByCustomerId.mockResolvedValue(
        mockTransactions,
      );

      const result = await handler.execute(merchantId, phone);

      expect(result.transactions[0].transactionDirection).toBe('RECEIVED');
    });

    it('should filter out VOUCHER_TRANSFER and REDEEM transactions', async () => {
      const merchantId = 'merchant-123';
      const phone = '0987654321';

      const mockTransactions = [
        MockDataFactory.createMockTransactionWithRelations({
          id: 'tx-1',
          transactionTypeId: 'TRANSFER',
        }),
        MockDataFactory.createMockTransactionWithRelations({
          id: 'tx-2',
          transactionTypeId: 'VOUCHER_TRANSFER', // Filtered
        }),
        MockDataFactory.createMockTransactionWithRelations({
          id: 'tx-3',
          transactionTypeId: 'REDEEM', // Filtered
        }),
        MockDataFactory.createMockTransactionWithRelations({
          id: 'tx-4',
          transactionTypeId: 'BURN',
        }),
      ];

      mockCustomerDB.getCustomerByPhoneDetailed.mockResolvedValue(mockCustomer);
      mockTransactionDB.getTransactionsByCustomerId.mockResolvedValue(
        mockTransactions,
      );

      const result = await handler.execute(merchantId, phone);

      expect(result.transactions).toHaveLength(2);
      expect(result.transactions[0].transactionTypeId).toBe('TRANSFER');
      expect(result.transactions[1].transactionTypeId).toBe('BURN');
    });
  });

  describe('execute - global (all merchants)', () => {
    it('should return point transactions from all merchants when merchantId is null', async () => {
      const phone = '0987654321';

      const mockTransactions = [
        MockDataFactory.createMockTransactionWithRelations({
          id: 'tx-merchant-1',
          merchantId: 'merchant-111',
          transactionTypeId: 'TRANSFER',
        }),
        MockDataFactory.createMockTransactionWithRelations({
          id: 'tx-merchant-2',
          merchantId: 'merchant-222',
          transactionTypeId: 'MINT',
        }),
      ];

      mockCustomerDB.getCustomerByPhoneDetailed.mockResolvedValue(mockCustomer);
      mockTransactionDB.getAllTransactionsByCustomerId.mockResolvedValue(
        mockTransactions,
      );

      const result = await handler.execute(null, phone);

      expect(
        mockTransactionDB.getAllTransactionsByCustomerId,
      ).toHaveBeenCalledWith('customer-123');
      expect(
        mockTransactionDB.getTransactionsByCustomerId,
      ).not.toHaveBeenCalled();
      expect(result.transactions).toHaveLength(2);
    });
  });

  describe('error handling', () => {
    it('should throw NotFoundException when customer not found', async () => {
      const merchantId = 'merchant-123';
      const phone = '0987654321';

      mockCustomerDB.getCustomerByPhoneDetailed.mockResolvedValue(null);

      await expect(handler.execute(merchantId, phone)).rejects.toThrow(
        NotFoundException,
      );
      await expect(handler.execute(merchantId, phone)).rejects.toThrow(
        `Customer with phone ${phone} not found`,
      );
    });

    it('should handle empty transactions array', async () => {
      const merchantId = 'merchant-123';
      const phone = '0987654321';

      mockCustomerDB.getCustomerByPhoneDetailed.mockResolvedValue(mockCustomer);
      mockTransactionDB.getTransactionsByCustomerId.mockResolvedValue([]);

      const result = await handler.execute(merchantId, phone);

      expect(result.transactions).toHaveLength(0);
      expect(result.counts).toBe(0);
    });
  });

  describe('response structure', () => {
    it('should return transactions with nested point object', async () => {
      const merchantId = 'merchant-123';
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
      mockTransactionDB.getTransactionsByCustomerId.mockResolvedValue(
        mockTransactions,
      );

      const result = await handler.execute(merchantId, phone);

      expect((result.transactions[0] as any).point).toEqual({
        id: 'point-123',
        name: 'Test Points',
        symbol: 'TST',
        imageUrl: 'https://example.com/point.png',
      });
    });

    it('should return transactions with sender and receiver objects', async () => {
      const merchantId = 'merchant-123';
      const phone = '0987654321';

      const mockTransactions = [
        MockDataFactory.createMockTransactionWithRelations({
          id: 'tx-1',
          transactionTypeId: 'TRANSFER',
        }),
      ];

      mockCustomerDB.getCustomerByPhoneDetailed.mockResolvedValue(mockCustomer);
      mockTransactionDB.getTransactionsByCustomerId.mockResolvedValue(
        mockTransactions,
      );

      const result = await handler.execute(merchantId, phone);

      expect((result.transactions[0] as any).sender).toHaveProperty('id');
      expect((result.transactions[0] as any).sender).toHaveProperty(
        'walletAddress',
      );
      expect((result.transactions[0] as any).sender).toHaveProperty(
        'emailOrWebsite',
      );
      expect((result.transactions[0] as any).receiver).toHaveProperty('id');
      expect((result.transactions[0] as any).receiver).toHaveProperty(
        'walletAddress',
      );
      expect((result.transactions[0] as any).receiver).toHaveProperty(
        'emailOrWebsite',
      );
    });

    it('should convert Buffer to hex string for txHash and addresses', async () => {
      const merchantId = 'merchant-123';
      const phone = '0987654321';

      const mockTransactions = [
        MockDataFactory.createMockTransactionWithRelations({
          id: 'tx-1',
          transactionTypeId: 'TRANSFER',
        }),
      ];

      mockCustomerDB.getCustomerByPhoneDetailed.mockResolvedValue(mockCustomer);
      mockTransactionDB.getTransactionsByCustomerId.mockResolvedValue(
        mockTransactions,
      );

      const result = await handler.execute(merchantId, phone);

      expect(typeof result.transactions[0].txHash).toBe('string');
      expect(result.transactions[0].txHash).toMatch(/^0x/);
      expect(typeof result.transactions[0].senderAddress).toBe('string');
      expect(result.transactions[0].senderAddress).toMatch(/^0x/);
      expect(typeof result.transactions[0].receiverAddress).toBe('string');
      expect(result.transactions[0].receiverAddress).toMatch(/^0x/);
    });
  });
});
