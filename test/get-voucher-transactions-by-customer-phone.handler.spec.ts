import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { GetVoucherTransactionsByCustomerPhone } from '../src/modules/transaction/handlers/getVoucherTransactionsByCustomerPhone.handler';
import { TransactionDBService } from '../src/modules/transaction/services/transaction-db.service';
import { CustomerDBService } from '../src/modules/customer/services/customer-db.service';
import {
  createMockTransactionDBService,
  createMockCustomerDBService,
} from './mocks/services.mock';
import { MockDataFactory } from './fixtures/mock-data.factory';

describe('GetVoucherTransactionsByCustomerPhone', () => {
  let handler: GetVoucherTransactionsByCustomerPhone;
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
        GetVoucherTransactionsByCustomerPhone,
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

    handler = module.get<GetVoucherTransactionsByCustomerPhone>(
      GetVoucherTransactionsByCustomerPhone,
    );

    jest.clearAllMocks();
  });

  describe('execute - merchant scoped', () => {
    it('should return only VOUCHER_TRANSFER and REDEEM transactions', async () => {
      const merchantId = 'merchant-123';
      const phone = '0987654321';

      const mockTransactions = [
        MockDataFactory.createMockTransactionWithRelations({
          id: 'tx-1',
          transactionTypeId: 'VOUCHER_TRANSFER',
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
          id: 'tx-2',
          transactionTypeId: 'REDEEM',
          senderId: 'customer-123',
          receiverId: 'merchant-123',
          voucherCode: {
            id: 'code-456',
            voucher: {
              id: 'voucher-456',
              name: 'Redeemed Voucher',
              valueType: 'percent',
              value: 20,
              imageUrl: 'https://example.com/voucher2.png',
            },
          },
        }),
        MockDataFactory.createMockTransactionWithRelations({
          id: 'tx-3',
          transactionTypeId: 'TRANSFER', // Should be filtered out
          senderId: 'merchant-123',
          receiverId: 'customer-123',
        }),
        MockDataFactory.createMockTransactionWithRelations({
          id: 'tx-4',
          transactionTypeId: 'MARKETPLACE_PURCHASE', // Should be filtered out
          senderId: 'customer-123',
          receiverId: 'merchant-123',
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
      expect(result.transactions).toHaveLength(2);
      expect(result.transactions[0].transactionTypeId).toBe('VOUCHER_TRANSFER');
      expect(result.transactions[1].transactionTypeId).toBe('REDEEM');
    });

    it('should not include MARKETPLACE_PURCHASE in voucher transactions', async () => {
      const merchantId = 'merchant-123';
      const phone = '0987654321';

      const mockTransactions = [
        MockDataFactory.createMockTransactionWithRelations({
          id: 'tx-marketplace',
          transactionTypeId: 'MARKETPLACE_PURCHASE', // This is point transaction
          senderId: 'customer-123',
          receiverId: 'merchant-123',
        }),
        MockDataFactory.createMockTransactionWithRelations({
          id: 'tx-voucher',
          transactionTypeId: 'VOUCHER_TRANSFER',
          senderId: 'customer-123',
          receiverId: 'customer-456',
        }),
      ];

      mockCustomerDB.getCustomerByPhoneDetailed.mockResolvedValue(mockCustomer);
      mockTransactionDB.getTransactionsByCustomerId.mockResolvedValue(
        mockTransactions,
      );

      const result = await handler.execute(merchantId, phone);

      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].transactionTypeId).toBe('VOUCHER_TRANSFER');
    });

    it('should include voucher details in response', async () => {
      const merchantId = 'merchant-123';
      const phone = '0987654321';

      const mockVoucher = {
        id: 'voucher-123',
        name: 'Test Voucher',
        valueType: 'cash',
        value: 100,
        imageUrl: 'https://example.com/voucher.png',
      };

      const mockTransactions = [
        MockDataFactory.createMockTransactionWithRelations({
          id: 'tx-1',
          transactionTypeId: 'VOUCHER_TRANSFER',
          senderId: 'customer-123',
          receiverId: 'customer-456',
          voucherCode: {
            id: 'code-123',
            voucher: mockVoucher,
          },
        }),
      ];

      mockCustomerDB.getCustomerByPhoneDetailed.mockResolvedValue(mockCustomer);
      mockTransactionDB.getTransactionsByCustomerId.mockResolvedValue(
        mockTransactions,
      );

      const result = await handler.execute(merchantId, phone);

      expect((result.transactions[0] as any).voucher).toEqual({
        id: 'voucher-123',
        name: 'Test Voucher',
        valueType: 'cash',
        value: 100,
        imageUrl: 'https://example.com/voucher.png',
      });
    });

    it('should calculate direction correctly for voucher transfers', async () => {
      const merchantId = 'merchant-123';
      const phone = '0987654321';

      const mockTransactions = [
        MockDataFactory.createMockTransactionWithRelations({
          id: 'tx-sent',
          transactionTypeId: 'VOUCHER_TRANSFER',
          senderId: 'customer-123', // Customer is sender
          receiverId: 'customer-456',
        }),
        MockDataFactory.createMockTransactionWithRelations({
          id: 'tx-received',
          transactionTypeId: 'VOUCHER_TRANSFER',
          senderId: 'customer-456',
          receiverId: 'customer-123', // Customer is receiver
        }),
      ];

      mockCustomerDB.getCustomerByPhoneDetailed.mockResolvedValue(mockCustomer);
      mockTransactionDB.getTransactionsByCustomerId.mockResolvedValue(
        mockTransactions,
      );

      const result = await handler.execute(merchantId, phone);

      expect(result.transactions[0].transactionDirection).toBe('SENT');
      expect(result.transactions[1].transactionDirection).toBe('RECEIVED');
    });
  });

  describe('execute - global (all merchants)', () => {
    it('should return voucher transactions from all merchants when merchantId is null', async () => {
      const phone = '0987654321';

      const mockTransactions = [
        MockDataFactory.createMockTransactionWithRelations({
          id: 'tx-merchant-1',
          merchantId: 'merchant-111',
          transactionTypeId: 'VOUCHER_TRANSFER',
        }),
        MockDataFactory.createMockTransactionWithRelations({
          id: 'tx-merchant-2',
          merchantId: 'merchant-222',
          transactionTypeId: 'REDEEM',
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

    it('should filter correctly when called globally', async () => {
      const phone = '0987654321';

      const mockTransactions = [
        MockDataFactory.createMockTransactionWithRelations({
          id: 'tx-1',
          transactionTypeId: 'VOUCHER_TRANSFER',
        }),
        MockDataFactory.createMockTransactionWithRelations({
          id: 'tx-2',
          transactionTypeId: 'TRANSFER', // Filtered out
        }),
        MockDataFactory.createMockTransactionWithRelations({
          id: 'tx-3',
          transactionTypeId: 'REDEEM',
        }),
      ];

      mockCustomerDB.getCustomerByPhoneDetailed.mockResolvedValue(mockCustomer);
      mockTransactionDB.getAllTransactionsByCustomerId.mockResolvedValue(
        mockTransactions,
      );

      const result = await handler.execute(null, phone);

      expect(result.transactions).toHaveLength(2);
      expect(result.transactions[0].transactionTypeId).toBe('VOUCHER_TRANSFER');
      expect(result.transactions[1].transactionTypeId).toBe('REDEEM');
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

    it('should handle transactions with no voucher ownership types', async () => {
      const merchantId = 'merchant-123';
      const phone = '0987654321';

      const mockTransactions = [
        MockDataFactory.createMockTransactionWithRelations({
          id: 'tx-1',
          transactionTypeId: 'TRANSFER',
        }),
        MockDataFactory.createMockTransactionWithRelations({
          id: 'tx-2',
          transactionTypeId: 'MINT',
        }),
      ];

      mockCustomerDB.getCustomerByPhoneDetailed.mockResolvedValue(mockCustomer);
      mockTransactionDB.getTransactionsByCustomerId.mockResolvedValue(
        mockTransactions,
      );

      const result = await handler.execute(merchantId, phone);

      expect(result.transactions).toHaveLength(0); // All filtered out
      expect(result.counts).toBe(0);
    });
  });

  describe('response structure', () => {
    it('should return transactions with nested voucher object', async () => {
      const merchantId = 'merchant-123';
      const phone = '0987654321';

      const mockTransactions = [
        MockDataFactory.createMockTransactionWithRelations({
          id: 'tx-1',
          transactionTypeId: 'VOUCHER_TRANSFER',
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

      expect((result.transactions[0] as any).voucher).toBeDefined();
      expect((result.transactions[0] as any).voucher.id).toBe('voucher-123');
      expect((result.transactions[0] as any).voucher.name).toBe('Test Voucher');
    });

    it('should return transactions with nested point object', async () => {
      const merchantId = 'merchant-123';
      const phone = '0987654321';

      const mockTransactions = [
        MockDataFactory.createMockTransactionWithRelations({
          id: 'tx-1',
          transactionTypeId: 'REDEEM',
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

      expect((result.transactions[0] as any).point).toMatchObject({
        id: 'point-123',
        name: 'Test Points',
        symbol: 'TST',
        imageUrl: 'https://example.com/point.png',
      });
    });

    it('should convert Buffer to hex string for addresses', async () => {
      const merchantId = 'merchant-123';
      const phone = '0987654321';

      const mockTransactions = [
        MockDataFactory.createMockTransactionWithRelations({
          id: 'tx-1',
          transactionTypeId: 'VOUCHER_TRANSFER',
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
      expect(typeof result.transactions[0].receiverAddress).toBe('string');
    });
  });
});
