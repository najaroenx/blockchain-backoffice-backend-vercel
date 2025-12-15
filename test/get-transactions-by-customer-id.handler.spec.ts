import { Test, TestingModule } from '@nestjs/testing';
import { GetTransactionsByCustomerId } from '../src/modules/transaction/handlers/getTransactionsByCustomerId.handler';
import { TransactionDBService } from '../src/modules/transaction/services/transaction-db.service';
import { GetCustomerPhone } from '../src/modules/customer/handlers/getCustomerByPhone.handler';
import { InternalServerErrorException } from '@nestjs/common';
import { TransactionTypeId } from '../src/constants/transaction-types.enum';

describe('GetTransactionsByCustomerId', () => {
  let handler: GetTransactionsByCustomerId;
  let transactionDBService: jest.Mocked<TransactionDBService>;
  let getCustomerByPhone: jest.Mocked<GetCustomerPhone>;

  const mockMerchantId = 'merchant-123';
  const mockCustomerId = 'customer-456';
  const mockPhone = '0801234567';

  const mockCustomer = {
    id: mockCustomerId,
    phone: mockPhone,
    email: 'customer@test.com',
    wallet: {
      walletAddress: '0xCustomerWallet123',
    },
  };

  const mockSentTransaction = {
    id: 'tx-sent-1',
    txHash: Buffer.from('abc123', 'hex'),
    senderAddress: Buffer.from('sender123', 'hex'),
    receiverAddress: Buffer.from('receiver123', 'hex'),
    transactionTypeId: TransactionTypeId.TRANSFER,
    amount: 100,
    senderId: mockCustomerId,
    receiverId: 'other-customer',
    voucherCodeId: null,
    eventId: null,
    createdAt: new Date('2024-01-01'),
    sender: {
      id: mockCustomerId,
      email: 'customer@test.com',
      wallet: { walletAddress: '0xCustomerWallet123' },
    },
    receiver: {
      id: 'other-customer',
      email: 'other@test.com',
      wallet: { walletAddress: '0xOtherWallet456' },
    },
    merchant: {
      id: mockMerchantId,
      website: 'https://merchant.com',
    },
    point: {
      id: 'point-1',
      name: 'Loyalty Points',
      symbol: 'LP',
      imageUrl: 'https://image.com/lp.png',
    },
    voucherCode: null,
  };

  const mockReceivedTransaction = {
    id: 'tx-received-1',
    txHash: Buffer.from('def456', 'hex'),
    senderAddress: Buffer.from('sender456', 'hex'),
    receiverAddress: Buffer.from('receiver456', 'hex'),
    transactionTypeId: TransactionTypeId.MINT,
    amount: 200,
    senderId: null,
    receiverId: mockCustomerId,
    voucherCodeId: null,
    eventId: null,
    createdAt: new Date('2024-01-02'),
    sender: null,
    receiver: {
      id: mockCustomerId,
      email: 'customer@test.com',
      wallet: { walletAddress: '0xCustomerWallet123' },
    },
    merchant: {
      id: mockMerchantId,
      website: 'https://merchant.com',
    },
    point: {
      id: 'point-1',
      name: 'Loyalty Points',
      symbol: 'LP',
      imageUrl: null,
    },
    voucherCode: null,
  };

  beforeEach(async () => {
    const mockTransactionDB = {
      getTransactionsByCustomerId: jest.fn(),
    };

    const mockGetCustomer = {
      execute: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetTransactionsByCustomerId,
        {
          provide: TransactionDBService,
          useValue: mockTransactionDB,
        },
        {
          provide: GetCustomerPhone,
          useValue: mockGetCustomer,
        },
      ],
    }).compile();

    handler = module.get<GetTransactionsByCustomerId>(
      GetTransactionsByCustomerId,
    );
    transactionDBService = module.get(
      TransactionDBService,
    ) as jest.Mocked<TransactionDBService>;
    getCustomerByPhone = module.get(
      GetCustomerPhone,
    ) as jest.Mocked<GetCustomerPhone>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute - by phone', () => {
    it('should return transactions with SENT direction', async () => {
      // Arrange
      getCustomerByPhone.execute.mockResolvedValue({
        customer: mockCustomer,
      } as any);
      transactionDBService.getTransactionsByCustomerId.mockResolvedValue([
        mockSentTransaction,
      ] as any);

      // Act
      const result = await handler.execute(mockMerchantId, mockPhone);

      // Assert
      expect(getCustomerByPhone.execute).toHaveBeenCalledWith(
        mockMerchantId,
        mockPhone,
      );
      expect(
        transactionDBService.getTransactionsByCustomerId,
      ).toHaveBeenCalledWith(mockCustomerId, mockMerchantId);
      expect(result.counts).toBe(1);
      expect(result.transactions[0].transactionDirection).toBe('SENT');
      expect(result.transactions[0].id).toBe('tx-sent-1');
      expect(result.transactions[0].amount).toBe(100);
    });

    it('should return transactions with RECEIVED direction', async () => {
      // Arrange
      getCustomerByPhone.execute.mockResolvedValue({
        customer: mockCustomer,
      } as any);
      transactionDBService.getTransactionsByCustomerId.mockResolvedValue([
        mockReceivedTransaction,
      ] as any);

      // Act
      const result = await handler.execute(mockMerchantId, mockPhone);

      // Assert
      expect(result.counts).toBe(1);
      expect(result.transactions[0].transactionDirection).toBe('RECEIVED');
      expect(result.transactions[0].id).toBe('tx-received-1');
    });

    it('should return multiple transactions', async () => {
      // Arrange
      getCustomerByPhone.execute.mockResolvedValue({
        customer: mockCustomer,
      } as any);
      transactionDBService.getTransactionsByCustomerId.mockResolvedValue([
        mockSentTransaction,
        mockReceivedTransaction,
      ] as any);

      // Act
      const result = await handler.execute(mockMerchantId, mockPhone);

      // Assert
      expect(result.counts).toBe(2);
      expect(result.transactions).toHaveLength(2);
    });

    it('should return empty array when no transactions', async () => {
      // Arrange
      getCustomerByPhone.execute.mockResolvedValue({
        customer: mockCustomer,
      } as any);
      transactionDBService.getTransactionsByCustomerId.mockResolvedValue([]);

      // Act
      const result = await handler.execute(mockMerchantId, mockPhone);

      // Assert
      expect(result.counts).toBe(0);
      expect(result.transactions).toHaveLength(0);
    });

    it('should throw InternalServerErrorException when customer not found', async () => {
      // Arrange
      getCustomerByPhone.execute.mockResolvedValue({
        message: 'Customer not found',
      } as any);

      // Act & Assert
      await expect(
        handler.execute(mockMerchantId, mockPhone),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException on database error', async () => {
      // Arrange
      getCustomerByPhone.execute.mockResolvedValue({
        customer: mockCustomer,
      } as any);
      transactionDBService.getTransactionsByCustomerId.mockRejectedValue(
        new Error('Database error'),
      );

      // Act & Assert
      await expect(
        handler.execute(mockMerchantId, mockPhone),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('executeByCustomerId - by customer ID', () => {
    it('should return transactions with SENT direction', async () => {
      // Arrange
      transactionDBService.getTransactionsByCustomerId.mockResolvedValue([
        mockSentTransaction,
      ] as any);

      // Act
      const result = await handler.executeByCustomerId(
        mockMerchantId,
        mockCustomerId,
      );

      // Assert
      expect(
        transactionDBService.getTransactionsByCustomerId,
      ).toHaveBeenCalledWith(mockCustomerId, mockMerchantId);
      expect(result.counts).toBe(1);
      expect(result.transactions[0].transactionDirection).toBe('SENT');
    });

    it('should return transactions with RECEIVED direction', async () => {
      // Arrange
      transactionDBService.getTransactionsByCustomerId.mockResolvedValue([
        mockReceivedTransaction,
      ] as any);

      // Act
      const result = await handler.executeByCustomerId(
        mockMerchantId,
        mockCustomerId,
      );

      // Assert
      expect(result.counts).toBe(1);
      expect(result.transactions[0].transactionDirection).toBe('RECEIVED');
    });

    it('should return empty array when no transactions', async () => {
      // Arrange
      transactionDBService.getTransactionsByCustomerId.mockResolvedValue([]);

      // Act
      const result = await handler.executeByCustomerId(
        mockMerchantId,
        mockCustomerId,
      );

      // Assert
      expect(result.counts).toBe(0);
      expect(result.transactions).toHaveLength(0);
    });

    it('should throw InternalServerErrorException on database error', async () => {
      // Arrange
      transactionDBService.getTransactionsByCustomerId.mockRejectedValue(
        new Error('Database error'),
      );

      // Act & Assert
      await expect(
        handler.executeByCustomerId(mockMerchantId, mockCustomerId),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });
});
