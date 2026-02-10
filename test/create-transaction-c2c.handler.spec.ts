import { Test, TestingModule } from '@nestjs/testing';
import { CreateTransactionC2C } from '../src/modules/internal/transaction/handlers/createTransactionC2C.handler';
import { TransactionDBService } from '../src/modules/internal/transaction/services/transaction-db.service';
import { GetPointById } from '../src/modules/internal/point/handlers/getPointById.handler';
import { BlockchainService } from '../src/providers/blockchain/blockchain.service';
import { GetCustomerPhone } from '../src/modules/internal/customer/handlers/getCustomerByPhone.handler';
import { UpdateCustomer } from '../src/modules/internal/customer/handlers/updateCustomer.handler';
import { TokenService } from '../src/providers/token/token.service';
import { ConfigService } from '@nestjs/config';
import { InternalServerErrorException } from '@nestjs/common';
import { TransactionTypeId } from '../src/constants/transaction-types.enum';

jest.mock('src/libs/derive-wallet', () => ({
  getSignerFromSeedPhrase: jest.fn().mockReturnValue({
    privateKey:
      '0x1234567890123456789012345678901234567890123456789012345678901234',
    address: '0x1234567890123456789012345678901234567890',
  }),
  deriveChildWallet: jest.fn(),
}));

describe('CreateTransactionC2C', () => {
  let handler: CreateTransactionC2C;
  let transactionDBService: jest.Mocked<TransactionDBService>;
  let getPointByIdHandler: jest.Mocked<GetPointById>;
  let blockchainService: jest.Mocked<BlockchainService>;
  let getCustomerByPhone: jest.Mocked<GetCustomerPhone>;
  let updateCustomer: jest.Mocked<UpdateCustomer>;
  let tokenService: jest.Mocked<TokenService>;
  let configService: jest.Mocked<ConfigService>;

  // Mock data
  const mockMerchantId = 'merchant-123';
  const mockPointId = 'point-456';
  const mockSalt = 'test-salt-key';

  const mockPoint = {
    id: mockPointId,
    name: 'Loyalty Points',
    contractAddress: '0xPointContract123',
    merchantId: mockMerchantId,
    symbol: 'LP',
    decimals: 18,
  };

  const mockSenderCustomer = {
    id: 'customer-sender-123',
    phone: '0801234567',
    email: 'sender@test.com',
    wallet: {
      id: 'wallet-sender-1',
      walletAddress: '0xSenderWallet123',
      privateKey: 'encrypted-sender-key',
      seedPhrase: 'encrypted-sender-seed-phrase',
      derivationIndex: 0,
    },
    customerPoints: [
      {
        id: 'cp-sender-1',
        pointId: mockPointId,
        customerId: 'customer-sender-123',
        balances: 1000,
      },
    ],
    customerMerChant: [
      {
        id: 'cm-1',
        merchantId: mockMerchantId,
        customerId: 'customer-sender-123',
      },
    ],
  };

  const mockReceiverCustomer = {
    id: 'customer-receiver-456',
    phone: '0809876543',
    email: 'receiver@test.com',
    wallet: {
      id: 'wallet-receiver-1',
      walletAddress: '0xReceiverWallet456',
      privateKey: 'encrypted-receiver-key',
      seedPhrase: 'encrypted-receiver-seed-phrase',
      derivationIndex: 0,
    },
    customerPoints: [
      {
        id: 'cp-receiver-1',
        pointId: mockPointId,
        customerId: 'customer-receiver-456',
        balances: 500,
      },
    ],
    customerMerChant: [
      {
        id: 'cm-2',
        merchantId: mockMerchantId,
        customerId: 'customer-receiver-456',
      },
    ],
  };

  const mockReceiverWithoutPoints = {
    ...mockReceiverCustomer,
    customerPoints: [],
  };

  const mockTransaction = {
    id: 'transaction-789',
    merchantId: mockMerchantId,
    pointId: mockPointId,
    senderId: mockSenderCustomer.id,
    receiverId: mockReceiverCustomer.id,
    amount: 100,
    transactionTypeId: TransactionTypeId.TRANSFER,
    txHash: Buffer.from('0xtxhash123'.replace(/^0x/, ''), 'hex'),
    senderAddress: Buffer.from(
      mockSenderCustomer.wallet.walletAddress.replace(/^0x/, ''),
      'hex',
    ),
    receiverAddress: Buffer.from(
      mockReceiverCustomer.wallet.walletAddress.replace(/^0x/, ''),
      'hex',
    ),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTransactionData = {
    amount: 100,
    fromPhone: '0801234567',
    toPhone: '0809876543',
    description: 'Test C2C transfer',
  };

  beforeEach(async () => {
    const mockTransactionDB = {
      createTransaction: jest.fn(),
    };

    const mockGetPointById = {
      execute: jest.fn(),
    };

    const mockBlockchain = {
      transactionC2C: jest.fn(),
    };

    const mockGetCustomer = {
      execute: jest.fn(),
    };

    const mockUpdateCustomerHandler = {
      execute: jest.fn(),
    };

    const mockToken = {
      decryptKey: jest.fn(),
    };

    const mockConfig = {
      get: jest.fn().mockReturnValue(mockSalt),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateTransactionC2C,
        {
          provide: TransactionDBService,
          useValue: mockTransactionDB,
        },
        {
          provide: GetPointById,
          useValue: mockGetPointById,
        },
        {
          provide: BlockchainService,
          useValue: mockBlockchain,
        },
        {
          provide: GetCustomerPhone,
          useValue: mockGetCustomer,
        },
        {
          provide: UpdateCustomer,
          useValue: mockUpdateCustomerHandler,
        },
        {
          provide: TokenService,
          useValue: mockToken,
        },
        {
          provide: ConfigService,
          useValue: mockConfig,
        },
      ],
    }).compile();

    handler = module.get<CreateTransactionC2C>(CreateTransactionC2C);
    transactionDBService = module.get(
      TransactionDBService,
    ) as jest.Mocked<TransactionDBService>;
    getPointByIdHandler = module.get(GetPointById) as jest.Mocked<GetPointById>;
    blockchainService = module.get(
      BlockchainService,
    ) as jest.Mocked<BlockchainService>;
    getCustomerByPhone = module.get(
      GetCustomerPhone,
    ) as jest.Mocked<GetCustomerPhone>;
    updateCustomer = module.get(UpdateCustomer) as jest.Mocked<UpdateCustomer>;
    tokenService = module.get(TokenService) as jest.Mocked<TokenService>;
    configService = module.get(ConfigService) as jest.Mocked<ConfigService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute - successful C2C transfer', () => {
    it('should create C2C transaction when both customers have points', async () => {
      // Arrange
      getPointByIdHandler.execute.mockResolvedValue({
        point: mockPoint as any,
      });
      getCustomerByPhone.execute
        .mockResolvedValueOnce({ customer: mockSenderCustomer } as any)
        .mockResolvedValueOnce({ customer: mockReceiverCustomer } as any);
      tokenService.decryptKey.mockReturnValue('decrypted-private-key');
      blockchainService.transactionC2C.mockResolvedValue({
        txId: '0xtxhash123',
      } as any);
      transactionDBService.createTransaction.mockResolvedValue(
        mockTransaction as any,
      );
      updateCustomer.execute.mockResolvedValue({} as any);

      // Act
      const result = await handler.execute(
        mockMerchantId,
        mockPointId,
        mockTransactionData,
      );

      // Assert
      expect(getPointByIdHandler.execute).toHaveBeenCalledWith(
        mockPointId,
        mockMerchantId,
      );
      expect(getCustomerByPhone.execute).toHaveBeenCalledTimes(2);
      expect(getCustomerByPhone.execute).toHaveBeenNthCalledWith(
        1,
        mockMerchantId,
        '0801234567',
      );
      expect(getCustomerByPhone.execute).toHaveBeenNthCalledWith(
        2,
        mockMerchantId,
        '0809876543',
      );
      expect(tokenService.decryptKey).toHaveBeenCalledWith(
        mockSalt,
        'encrypted-sender-seed-phrase',
      );
      expect(blockchainService.transactionC2C).toHaveBeenCalledWith({
        amount: 100,
        to: '0xReceiverWallet456',
        senderPrivateKey:
          '0x1234567890123456789012345678901234567890123456789012345678901234',
        pointAddress: '0xPointContract123',
      });
      expect(transactionDBService.createTransaction).toHaveBeenCalled();
      expect(updateCustomer.execute).toHaveBeenCalledTimes(2); // Update receiver and sender
      expect(result).toHaveProperty('id', 'transaction-789');
      expect(result).toHaveProperty('txHash');
    });

    it('should create point tokens for receiver if they do not exist', async () => {
      // Arrange
      getPointByIdHandler.execute.mockResolvedValue({
        point: mockPoint as any,
      });
      getCustomerByPhone.execute
        .mockResolvedValueOnce({ customer: mockSenderCustomer } as any)
        .mockResolvedValueOnce({ customer: mockReceiverWithoutPoints } as any);
      tokenService.decryptKey.mockReturnValue('decrypted-private-key');
      blockchainService.transactionC2C.mockResolvedValue({
        txId: '0xtxhash123',
      } as any);
      transactionDBService.createTransaction.mockResolvedValue(
        mockTransaction as any,
      );
      updateCustomer.execute.mockResolvedValue({} as any);

      // Act
      await handler.execute(mockMerchantId, mockPointId, mockTransactionData);

      // Assert
      expect(updateCustomer.execute).toHaveBeenCalledTimes(2);
      // Verify first call creates new customer points for receiver
      expect(updateCustomer.execute).toHaveBeenNthCalledWith(
        1,
        mockReceiverWithoutPoints.id,
        {
          customerPoints: {
            create: { pointId: mockPointId, balances: 100 },
          },
        },
      );
      // Verify second call updates sender's balance
      expect(updateCustomer.execute).toHaveBeenNthCalledWith(
        2,
        mockSenderCustomer.id,
        {
          customerPoints: {
            update: {
              where: { id: mockSenderCustomer.customerPoints[0].id },
              data: { balances: 900 }, // 1000 - 100
            },
          },
        },
      );
    });

    it('should update existing receiver point tokens', async () => {
      // Arrange
      getPointByIdHandler.execute.mockResolvedValue({
        point: mockPoint as any,
      });
      getCustomerByPhone.execute
        .mockResolvedValueOnce({ customer: mockSenderCustomer } as any)
        .mockResolvedValueOnce({ customer: mockReceiverCustomer } as any);
      tokenService.decryptKey.mockReturnValue('decrypted-private-key');
      blockchainService.transactionC2C.mockResolvedValue({
        txId: '0xtxhash123',
      } as any);
      transactionDBService.createTransaction.mockResolvedValue(
        mockTransaction as any,
      );
      updateCustomer.execute.mockResolvedValue({} as any);

      // Act
      await handler.execute(mockMerchantId, mockPointId, mockTransactionData);

      // Assert
      expect(updateCustomer.execute).toHaveBeenCalledTimes(2);
      // Verify first call updates existing receiver points
      expect(updateCustomer.execute).toHaveBeenNthCalledWith(
        1,
        mockReceiverCustomer.id,
        {
          customerPoints: {
            update: {
              where: { id: mockReceiverCustomer.customerPoints[0].id },
              data: { balances: 600 }, // 500 + 100
            },
          },
        },
      );
      // Verify second call updates sender's balance
      expect(updateCustomer.execute).toHaveBeenNthCalledWith(
        2,
        mockSenderCustomer.id,
        {
          customerPoints: {
            update: {
              where: { id: mockSenderCustomer.customerPoints[0].id },
              data: { balances: 900 }, // 1000 - 100
            },
          },
        },
      );
    });
  });

  describe('execute - error handling', () => {
    it('should throw InternalServerErrorException if sender not found', async () => {
      // Arrange
      getPointByIdHandler.execute.mockResolvedValue({
        point: mockPoint as any,
      });
      getCustomerByPhone.execute.mockResolvedValueOnce(null as any);

      // Act & Assert - BadRequestException is caught and converted to InternalServerErrorException
      await expect(
        handler.execute(mockMerchantId, mockPointId, mockTransactionData),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException if receiver not found', async () => {
      // Arrange
      getPointByIdHandler.execute.mockResolvedValue({
        point: mockPoint as any,
      });
      getCustomerByPhone.execute
        .mockResolvedValueOnce({ customer: mockSenderCustomer } as any)
        .mockResolvedValueOnce(null as any);

      // Act & Assert - BadRequestException is caught and converted to InternalServerErrorException
      await expect(
        handler.execute(mockMerchantId, mockPointId, mockTransactionData),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException if sender not registered with merchant', async () => {
      // Arrange
      const customerNotInMerchant = {
        ...mockSenderCustomer,
        customerMerChant: [
          {
            id: 'cm-other',
            merchantId: 'other-merchant',
            customerId: mockSenderCustomer.id,
          },
        ],
      };

      getPointByIdHandler.execute.mockResolvedValue({
        point: mockPoint as any,
      });
      getCustomerByPhone.execute.mockResolvedValueOnce({
        customer: customerNotInMerchant,
      } as any);

      // Act & Assert - BadRequestException is caught and converted to InternalServerErrorException
      await expect(
        handler.execute(mockMerchantId, mockPointId, mockTransactionData),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException if receiver not registered with merchant', async () => {
      // Arrange
      const receiverNotInMerchant = {
        ...mockReceiverCustomer,
        customerMerChant: [
          {
            id: 'cm-other',
            merchantId: 'other-merchant',
            customerId: mockReceiverCustomer.id,
          },
        ],
      };

      getPointByIdHandler.execute.mockResolvedValue({
        point: mockPoint as any,
      });
      getCustomerByPhone.execute
        .mockResolvedValueOnce({ customer: mockSenderCustomer } as any)
        .mockResolvedValueOnce({ customer: receiverNotInMerchant } as any);

      // Act & Assert - BadRequestException is caught and converted to InternalServerErrorException
      await expect(
        handler.execute(mockMerchantId, mockPointId, mockTransactionData),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException on blockchain RPC error', async () => {
      // Arrange
      getPointByIdHandler.execute.mockResolvedValue({
        point: mockPoint as any,
      });
      getCustomerByPhone.execute
        .mockResolvedValueOnce({ customer: mockSenderCustomer } as any)
        .mockResolvedValueOnce({ customer: mockReceiverCustomer } as any);
      tokenService.decryptKey.mockReturnValue('decrypted-private-key');
      blockchainService.transactionC2C.mockRejectedValue(
        new Error('500001: RPC server error'),
      );

      // Act & Assert
      await expect(
        handler.execute(mockMerchantId, mockPointId, mockTransactionData),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException on general error', async () => {
      // Arrange
      getPointByIdHandler.execute.mockResolvedValue({
        point: mockPoint as any,
      });
      getCustomerByPhone.execute
        .mockResolvedValueOnce({ customer: mockSenderCustomer } as any)
        .mockResolvedValueOnce({ customer: mockReceiverCustomer } as any);
      tokenService.decryptKey.mockReturnValue('decrypted-private-key');
      blockchainService.transactionC2C.mockRejectedValue(
        new Error('Unexpected blockchain error'),
      );

      // Act & Assert
      await expect(
        handler.execute(mockMerchantId, mockPointId, mockTransactionData),
      ).rejects.toThrow(InternalServerErrorException);
      await expect(
        handler.execute(mockMerchantId, mockPointId, mockTransactionData),
      ).rejects.toThrow('500000: Internal server error');
    });

    it('should throw InternalServerErrorException if transaction creation fails', async () => {
      // Arrange
      getPointByIdHandler.execute.mockResolvedValue({
        point: mockPoint as any,
      });
      getCustomerByPhone.execute
        .mockResolvedValueOnce({ customer: mockSenderCustomer } as any)
        .mockResolvedValueOnce({ customer: mockReceiverCustomer } as any);
      tokenService.decryptKey.mockReturnValue('decrypted-private-key');
      blockchainService.transactionC2C.mockResolvedValue({
        txId: '0xtxhash123',
      } as any);
      transactionDBService.createTransaction.mockRejectedValue(
        new Error('Database error'),
      );

      // Act & Assert
      await expect(
        handler.execute(mockMerchantId, mockPointId, mockTransactionData),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException if customer update fails', async () => {
      // Arrange
      getPointByIdHandler.execute.mockResolvedValue({
        point: mockPoint as any,
      });
      getCustomerByPhone.execute
        .mockResolvedValueOnce({ customer: mockSenderCustomer } as any)
        .mockResolvedValueOnce({ customer: mockReceiverCustomer } as any);
      tokenService.decryptKey.mockReturnValue('decrypted-private-key');
      blockchainService.transactionC2C.mockResolvedValue({
        txId: '0xtxhash123',
      } as any);
      transactionDBService.createTransaction.mockResolvedValue(
        mockTransaction as any,
      );
      updateCustomer.execute.mockRejectedValue(new Error('Update failed'));

      // Act & Assert
      await expect(
        handler.execute(mockMerchantId, mockPointId, mockTransactionData),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('execute - transaction data validation', () => {
    it('should correctly format transaction buffers', async () => {
      // Arrange
      getPointByIdHandler.execute.mockResolvedValue({
        point: mockPoint as any,
      });
      getCustomerByPhone.execute
        .mockResolvedValueOnce({ customer: mockSenderCustomer } as any)
        .mockResolvedValueOnce({ customer: mockReceiverCustomer } as any);
      tokenService.decryptKey.mockReturnValue('decrypted-private-key');
      blockchainService.transactionC2C.mockResolvedValue({
        txId: '0xabcdef123456',
      } as any);
      transactionDBService.createTransaction.mockResolvedValue(
        mockTransaction as any,
      );
      updateCustomer.execute.mockResolvedValue({} as any);

      // Act
      await handler.execute(mockMerchantId, mockPointId, mockTransactionData);

      // Assert
      expect(transactionDBService.createTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 100,
          merchant: { connect: { id: mockMerchantId } },
          point: { connect: { id: mockPointId } },
          senderId: mockSenderCustomer.id,
          senderType: 'CUSTOMER',
          receiverId: mockReceiverCustomer.id,
          receiverType: 'CUSTOMER',
          transactionType: { connect: { id: TransactionTypeId.TRANSFER } },
          transactionRefId: expect.any(String),
          type: 'POINT',
          txHash: expect.any(Uint8Array),
          senderAddress: expect.any(Buffer),
          receiverAddress: expect.any(Buffer),
        }),
      );
    });

    it('should include description in transaction data', async () => {
      // Arrange
      const dataWithDescription = {
        ...mockTransactionData,
        description: 'Payment for services',
      };

      getPointByIdHandler.execute.mockResolvedValue({
        point: mockPoint as any,
      });
      getCustomerByPhone.execute
        .mockResolvedValueOnce({ customer: mockSenderCustomer } as any)
        .mockResolvedValueOnce({ customer: mockReceiverCustomer } as any);
      tokenService.decryptKey.mockReturnValue('decrypted-private-key');
      blockchainService.transactionC2C.mockResolvedValue({
        txId: '0xtxhash123',
      } as any);
      transactionDBService.createTransaction.mockResolvedValue(
        mockTransaction as any,
      );
      updateCustomer.execute.mockResolvedValue({} as any);

      // Act
      await handler.execute(mockMerchantId, mockPointId, dataWithDescription);

      // Assert
      expect(transactionDBService.createTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Payment for services',
        }),
      );
    });
  });
});
