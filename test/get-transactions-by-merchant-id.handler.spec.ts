import { Test, TestingModule } from '@nestjs/testing';
import { GetTransactionsByMerchantId } from '../src/modules/transaction/handlers/getTransactionsByMerchantId.handler';
import { TransactionDBService } from '../src/modules/transaction/services/transaction-db.service';
import { InternalServerErrorException } from '@nestjs/common';
import { TransactionTypeId } from '../src/constants/transaction-types.enum';

describe('GetTransactionsByMerchantId', () => {
  let handler: GetTransactionsByMerchantId;
  let transactionDBService: jest.Mocked<TransactionDBService>;

  const mockMerchantId = 'merchant-123';

  const mockB2CTransaction = {
    id: 'tx-b2c-1',
    txHash: Buffer.from('abc123', 'hex'),
    senderAddress: Buffer.from('sender123', 'hex'),
    receiverAddress: Buffer.from('receiver123', 'hex'),
    transactionTypeId: TransactionTypeId.MINT,
    amount: 100,
    senderId: null,
    receiverId: 'customer-1',
    voucherCodeId: null,
    eventId: null,
    createdAt: new Date('2024-01-01'),
    merchantSenderId: null,
    merchantReceiverId: null,
    sender: null,
    receiver: {
      id: 'customer-1',
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
      imageUrl: 'https://image.com/lp.png',
    },
    voucherCode: null,
  };

  const mockC2MTransaction = {
    id: 'tx-c2m-1',
    txHash: Buffer.from('def456', 'hex'),
    senderAddress: Buffer.from('sender456', 'hex'),
    receiverAddress: Buffer.from('receiver456', 'hex'),
    transactionTypeId: TransactionTypeId.TRANSFER,
    amount: 200,
    senderId: 'customer-2',
    receiverId: null,
    voucherCodeId: null,
    eventId: null,
    createdAt: new Date('2024-01-02'),
    merchantSenderId: null,
    merchantReceiverId: mockMerchantId,
    sender: {
      id: 'customer-2',
      email: 'sender@test.com',
      wallet: { walletAddress: '0xSenderWallet456' },
    },
    receiver: null,
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

  const mockMerchantBuysVoucher = {
    id: 'tx-voucher-1',
    txHash: Buffer.from('ghi789', 'hex'),
    senderAddress: Buffer.from('sender789', 'hex'),
    receiverAddress: Buffer.from('receiver789', 'hex'),
    transactionTypeId: TransactionTypeId.MARKETPLACE_PURCHASE,
    amount: 500,
    senderId: null,
    receiverId: null,
    voucherCodeId: 'voucher-code-1',
    eventId: null,
    createdAt: new Date('2024-01-03'),
    merchantSenderId: mockMerchantId,
    merchantReceiverId: 'seller-merchant-999',
    sender: null,
    receiver: null,
    merchant: {
      id: mockMerchantId,
      website: 'https://merchant.com',
    },
    point: null,
    voucherCode: {
      id: 'voucher-code-1',
      voucher: {
        id: 'voucher-1',
        name: 'Premium Voucher',
        valueType: 'FIXED',
        value: 50,
        imageUrl: 'https://image.com/voucher.png',
      },
    },
  };

  beforeEach(async () => {
    const mockTransactionDB = {
      getTransactionsByMerchantId: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetTransactionsByMerchantId,
        {
          provide: TransactionDBService,
          useValue: mockTransactionDB,
        },
      ],
    }).compile();

    handler = module.get<GetTransactionsByMerchantId>(
      GetTransactionsByMerchantId,
    );
    transactionDBService = module.get(
      TransactionDBService,
    ) as jest.Mocked<TransactionDBService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should return B2C transactions with SENT direction', async () => {
      // Arrange
      transactionDBService.getTransactionsByMerchantId.mockResolvedValue([
        mockB2CTransaction,
      ] as any);

      // Act
      const result = await handler.execute(mockMerchantId);

      // Assert
      expect(
        transactionDBService.getTransactionsByMerchantId,
      ).toHaveBeenCalledWith(mockMerchantId);
      expect(result.counts).toBe(1);
      expect(result.transactions[0].transactionDirection).toBe('SENT');
      expect(result.transactions[0].id).toBe('tx-b2c-1');
      expect(result.transactions[0].amount).toBe(100);
    });

    it('should return C2M transactions with RECEIVED direction', async () => {
      // Arrange
      transactionDBService.getTransactionsByMerchantId.mockResolvedValue([
        mockC2MTransaction,
      ] as any);

      // Act
      const result = await handler.execute(mockMerchantId);

      // Assert
      expect(result.counts).toBe(1);
      expect(result.transactions[0].transactionDirection).toBe('RECEIVED');
      expect(result.transactions[0].id).toBe('tx-c2m-1');
    });

    it('should return merchant voucher purchases with SENT direction', async () => {
      // Arrange
      transactionDBService.getTransactionsByMerchantId.mockResolvedValue([
        mockMerchantBuysVoucher,
      ] as any);

      // Act
      const result = await handler.execute(mockMerchantId);

      // Assert
      expect(result.counts).toBe(1);
      expect(result.transactions[0].transactionDirection).toBe('SENT');
      expect(result.transactions[0].id).toBe('tx-voucher-1');
      expect(result.transactions[0].voucherCodeId).toBe('voucher-code-1');
    });

    it('should return multiple transactions with mixed directions', async () => {
      // Arrange
      const mixedTransactions = [
        mockB2CTransaction,
        mockC2MTransaction,
        mockMerchantBuysVoucher,
      ];
      transactionDBService.getTransactionsByMerchantId.mockResolvedValue(
        mixedTransactions as any,
      );

      // Act
      const result = await handler.execute(mockMerchantId);

      // Assert
      expect(result.counts).toBe(3);
      expect(result.transactions).toHaveLength(3);
      expect(result.transactions[0].transactionDirection).toBe('SENT');
      expect(result.transactions[1].transactionDirection).toBe('RECEIVED');
      expect(result.transactions[2].transactionDirection).toBe('SENT');
    });

    it('should return empty array when merchant has no transactions', async () => {
      // Arrange
      transactionDBService.getTransactionsByMerchantId.mockResolvedValue([]);

      // Act
      const result = await handler.execute(mockMerchantId);

      // Assert
      expect(result.counts).toBe(0);
      expect(result.transactions).toHaveLength(0);
    });

    it('should throw InternalServerErrorException on database error', async () => {
      // Arrange
      transactionDBService.getTransactionsByMerchantId.mockRejectedValue(
        new Error('Database connection failed'),
      );

      // Act & Assert
      await expect(handler.execute(mockMerchantId)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should handle null eventId', async () => {
      // Arrange
      transactionDBService.getTransactionsByMerchantId.mockResolvedValue([
        mockB2CTransaction,
      ] as any);

      // Act
      const result = await handler.execute(mockMerchantId);

      // Assert
      expect(result.transactions[0].eventId).toBeNull();
    });

    it('should handle transactions with eventId', async () => {
      // Arrange
      const txWithEvent = {
        ...mockB2CTransaction,
        eventId: 'event-123',
      };
      transactionDBService.getTransactionsByMerchantId.mockResolvedValue([
        txWithEvent,
      ] as any);

      // Act
      const result = await handler.execute(mockMerchantId);

      // Assert
      expect(result.transactions[0].eventId).toBe('event-123');
    });

    it('should preserve createdAt timestamp', async () => {
      // Arrange
      transactionDBService.getTransactionsByMerchantId.mockResolvedValue([
        mockB2CTransaction,
      ] as any);

      // Act
      const result = await handler.execute(mockMerchantId);

      // Assert
      expect(result.transactions[0].createdAt).toEqual(
        new Date('2024-01-01'),
      );
    });

    it('should convert buffer addresses to strings', async () => {
      // Arrange
      transactionDBService.getTransactionsByMerchantId.mockResolvedValue([
        mockB2CTransaction,
      ] as any);

      // Act
      const result = await handler.execute(mockMerchantId);

      // Assert
      expect(result.transactions[0].txHash).toBeDefined();
      expect(typeof result.transactions[0].txHash).toBe('string');
      expect(result.transactions[0].senderAddress).toBeDefined();
      expect(typeof result.transactions[0].senderAddress).toBe('string');
      expect(result.transactions[0].receiverAddress).toBeDefined();
      expect(typeof result.transactions[0].receiverAddress).toBe('string');
    });
  });
});
