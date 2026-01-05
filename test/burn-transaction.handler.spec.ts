import { Test, TestingModule } from '@nestjs/testing';
import { BurnTransaction } from '../src/modules/transaction/handlers/burnTransaction.handler';
import { TransactionDBService } from '../src/modules/transaction/services/transaction-db.service';
import { GetPointById } from '../src/modules/point/handlers/getPointById.handler';
import { BlockchainService } from '../src/providers/blockchain/blockchain.service';
import { GetCustomerPhone } from '../src/modules/customer/handlers/getCustomerByPhone.handler';
import { UpdateCustomer } from '../src/modules/customer/handlers/updateCustomer.handler';
import { TokenService } from '../src/providers/token/token.service';
import { ConfigService } from '@nestjs/config';
import { InternalServerErrorException } from '@nestjs/common';
import { TransactionTypeId } from '../src/constants/transaction-types.enum';
import { ADDRESS_ZERO } from '../src/constants';

describe('BurnTransaction', () => {
  let handler: BurnTransaction;
  let transactionDBService: jest.Mocked<TransactionDBService>;
  let getPointByIdHandler: jest.Mocked<GetPointById>;
  let blockchainService: jest.Mocked<BlockchainService>;
  let getCustomerByPhone: jest.Mocked<GetCustomerPhone>;
  let updateCustomer: jest.Mocked<UpdateCustomer>;
  let tokenService: jest.Mocked<TokenService>;

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

  const mockCustomer = {
    id: 'customer-123',
    phone: '0801234567',
    email: 'customer@test.com',
    wallet: {
      id: 'wallet-1',
      walletAddress: '0xCustomerWallet123',
      privateKey: 'encrypted-customer-key',
    },
    customerPoints: [
      {
        id: mockPointId, // Must match point.id for handler's find logic: cp.id === point.id
        pointId: mockPointId,
        customerId: 'customer-123',
        balances: 1000,
        balance: 1000, // Handler uses 'balance' property
      },
    ],
    customerMerChant: [
      {
        id: 'cm-1',
        merchantId: mockMerchantId,
        customerId: 'customer-123',
      },
    ],
  };

  const mockTransaction = {
    id: 'transaction-789',
    merchantId: mockMerchantId,
    pointId: mockPointId,
    senderId: mockCustomer.id,
    receiverId: null,
    amount: 100,
    transactionTypeId: TransactionTypeId.BURN,
    txHash: Buffer.from('0xtxhash123'.replace(/^0x/, ''), 'hex'),
    senderAddress: Buffer.from(
      mockCustomer.wallet.walletAddress.replace(/^0x/, ''),
      'hex',
    ),
    receiverAddress: Buffer.from(ADDRESS_ZERO.replace(/^0x/, ''), 'hex'),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockBurnData = {
    amount: 100,
    fromPhone: '0801234567',
    description: 'Burn tokens',
  };

  beforeEach(async () => {
    const mockTransactionDB = {
      createTransaction: jest.fn(),
    };

    const mockGetPointById = {
      execute: jest.fn(),
    };

    const mockBlockchain = {
      burn: jest.fn(),
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
        BurnTransaction,
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

    handler = module.get<BurnTransaction>(BurnTransaction);
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
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute - successful burn', () => {
    it('should burn tokens successfully', async () => {
      // Arrange
      getPointByIdHandler.execute.mockResolvedValue({
        point: mockPoint as any,
      });
      getCustomerByPhone.execute.mockResolvedValue({
        customer: mockCustomer,
      } as any);
      tokenService.decryptKey.mockReturnValue('decrypted-private-key');
      blockchainService.burn.mockResolvedValue({ txId: '0xtxhash123' } as any);
      transactionDBService.createTransaction.mockResolvedValue(
        mockTransaction as any,
      );
      updateCustomer.execute.mockResolvedValue({} as any);

      // Act
      const result = await handler.execute(
        mockMerchantId,
        mockPointId,
        mockBurnData,
      );

      // Assert
      expect(getPointByIdHandler.execute).toHaveBeenCalledWith(
        mockPointId,
        mockMerchantId,
      );
      expect(getCustomerByPhone.execute).toHaveBeenCalledWith(
        mockMerchantId,
        '0801234567',
      );
      expect(tokenService.decryptKey).toHaveBeenCalledWith(
        mockSalt,
        'encrypted-customer-key',
      );
      expect(blockchainService.burn).toHaveBeenCalledWith({
        amount: 100,
        senderPrivateKey: 'decrypted-private-key',
        pointAddress: '0xPointContract123',
      });
      expect(transactionDBService.createTransaction).toHaveBeenCalled();
      expect(updateCustomer.execute).toHaveBeenCalledWith(mockCustomer.id, {
        customerPoints: {
          update: {
            where: { id: mockPointId }, // Handler uses cp.id === point.id
            data: { balances: 900 }, // 1000 - 100
          },
        },
      });
      expect(result).toHaveProperty('id', 'transaction-789');
      expect(result).toHaveProperty('txHash');
    });

    it('should update customer balance correctly after burn', async () => {
      // Arrange
      const highBalanceCustomer = {
        ...mockCustomer,
        customerPoints: [
          {
            id: mockPointId, // Must match point.id for handler's find logic
            pointId: mockPointId,
            customerId: 'customer-123',
            balances: 5000,
            balance: 5000,
          },
        ],
      };

      getPointByIdHandler.execute.mockResolvedValue({
        point: mockPoint as any,
      });
      getCustomerByPhone.execute.mockResolvedValue({
        customer: highBalanceCustomer,
      } as any);
      tokenService.decryptKey.mockReturnValue('decrypted-private-key');
      blockchainService.burn.mockResolvedValue({ txId: '0xtxhash123' } as any);
      transactionDBService.createTransaction.mockResolvedValue(
        mockTransaction as any,
      );
      updateCustomer.execute.mockResolvedValue({} as any);

      const burnAmount = 250;

      // Act
      await handler.execute(mockMerchantId, mockPointId, {
        ...mockBurnData,
        amount: burnAmount,
      });

      // Assert
      expect(updateCustomer.execute).toHaveBeenCalledWith(
        highBalanceCustomer.id,
        {
          customerPoints: {
            update: {
              where: { id: mockPointId }, // Handler uses cp.id === point.id
              data: { balances: 4750 }, // 5000 - 250
            },
          },
        },
      );
    });
  });

  describe('execute - transaction data validation', () => {
    it('should create transaction with correct data structure', async () => {
      // Arrange
      getPointByIdHandler.execute.mockResolvedValue({
        point: mockPoint as any,
      });
      getCustomerByPhone.execute.mockResolvedValue({
        customer: mockCustomer,
      } as any);
      tokenService.decryptKey.mockReturnValue('decrypted-private-key');
      blockchainService.burn.mockResolvedValue({ txId: '0xabcdef123' } as any);
      transactionDBService.createTransaction.mockResolvedValue(
        mockTransaction as any,
      );
      updateCustomer.execute.mockResolvedValue({} as any);

      // Act
      await handler.execute(mockMerchantId, mockPointId, mockBurnData);

      // Assert
      expect(transactionDBService.createTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 100,
          description: 'Burn tokens',
          merchant: { connect: { id: mockMerchantId } },
          point: { connect: { id: mockPointId } },
          sender: { connect: { id: mockCustomer.id } },
          transactionType: { connect: { id: TransactionTypeId.BURN } },
          txHash: expect.any(Uint8Array),
          senderAddress: expect.any(Buffer),
          receiverAddress: expect.any(Buffer),
        }),
      );
    });

    it('should set receiver address to ADDRESS_ZERO for burn', async () => {
      // Arrange
      getPointByIdHandler.execute.mockResolvedValue({
        point: mockPoint as any,
      });
      getCustomerByPhone.execute.mockResolvedValue({
        customer: mockCustomer,
      } as any);
      tokenService.decryptKey.mockReturnValue('decrypted-private-key');
      blockchainService.burn.mockResolvedValue({ txId: '0xtxhash123' } as any);
      transactionDBService.createTransaction.mockResolvedValue(
        mockTransaction as any,
      );
      updateCustomer.execute.mockResolvedValue({} as any);

      // Act
      await handler.execute(mockMerchantId, mockPointId, mockBurnData);

      // Assert
      const createCall =
        transactionDBService.createTransaction.mock.calls[0][0];
      const receiverAddressBuffer = createCall.receiverAddress as Buffer;
      const receiverAddressHex = '0x' + receiverAddressBuffer.toString('hex');

      expect(receiverAddressHex.toLowerCase()).toBe(ADDRESS_ZERO.toLowerCase());
    });

    it('should include optional fields in transaction data', async () => {
      // Arrange
      const dataWithExtras = {
        ...mockBurnData,
        description: 'Seasonal token burn',
        metadata: { campaign: 'winter-2025' },
      };

      getPointByIdHandler.execute.mockResolvedValue({
        point: mockPoint as any,
      });
      getCustomerByPhone.execute.mockResolvedValue({
        customer: mockCustomer,
      } as any);
      tokenService.decryptKey.mockReturnValue('decrypted-private-key');
      blockchainService.burn.mockResolvedValue({ txId: '0xtxhash123' } as any);
      transactionDBService.createTransaction.mockResolvedValue(
        mockTransaction as any,
      );
      updateCustomer.execute.mockResolvedValue({} as any);

      // Act
      await handler.execute(mockMerchantId, mockPointId, dataWithExtras as any);

      // Assert
      expect(transactionDBService.createTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Seasonal token burn',
          metadata: { campaign: 'winter-2025' },
        }),
      );
    });
  });

  describe('execute - error handling', () => {
    it('should throw InternalServerErrorException if customer not found', async () => {
      // Arrange
      getPointByIdHandler.execute.mockResolvedValue({
        point: mockPoint as any,
      });
      getCustomerByPhone.execute.mockResolvedValue(null as any);

      // Act & Assert
      await expect(
        handler.execute(mockMerchantId, mockPointId, mockBurnData),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException if customer not registered with merchant', async () => {
      // Arrange
      const customerNotInMerchant = {
        ...mockCustomer,
        customerMerChant: [
          {
            id: 'cm-other',
            merchantId: 'other-merchant-999',
            customerId: mockCustomer.id,
          },
        ],
      };

      getPointByIdHandler.execute.mockResolvedValue({
        point: mockPoint as any,
      });
      getCustomerByPhone.execute.mockResolvedValue({
        customer: customerNotInMerchant,
      } as any);

      // Act & Assert
      await expect(
        handler.execute(mockMerchantId, mockPointId, mockBurnData),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException on blockchain RPC error', async () => {
      // Arrange
      getPointByIdHandler.execute.mockResolvedValue({
        point: mockPoint as any,
      });
      getCustomerByPhone.execute.mockResolvedValue({
        customer: mockCustomer,
      } as any);
      tokenService.decryptKey.mockReturnValue('decrypted-private-key');
      blockchainService.burn.mockRejectedValue(
        new Error('500001: RPC server error'),
      );

      // Act & Assert
      await expect(
        handler.execute(mockMerchantId, mockPointId, mockBurnData),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException on general blockchain error', async () => {
      // Arrange
      getPointByIdHandler.execute.mockResolvedValue({
        point: mockPoint as any,
      });
      getCustomerByPhone.execute.mockResolvedValue({
        customer: mockCustomer,
      } as any);
      tokenService.decryptKey.mockReturnValue('decrypted-private-key');
      blockchainService.burn.mockRejectedValue(
        new Error('Blockchain network error'),
      );

      // Act & Assert
      await expect(
        handler.execute(mockMerchantId, mockPointId, mockBurnData),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException if transaction creation fails', async () => {
      // Arrange
      getPointByIdHandler.execute.mockResolvedValue({
        point: mockPoint as any,
      });
      getCustomerByPhone.execute.mockResolvedValue({
        customer: mockCustomer,
      } as any);
      tokenService.decryptKey.mockReturnValue('decrypted-private-key');
      blockchainService.burn.mockResolvedValue({ txId: '0xtxhash123' } as any);
      transactionDBService.createTransaction.mockRejectedValue(
        new Error('Database constraint violation'),
      );

      // Act & Assert
      await expect(
        handler.execute(mockMerchantId, mockPointId, mockBurnData),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException if balance update fails', async () => {
      // Arrange
      getPointByIdHandler.execute.mockResolvedValue({
        point: mockPoint as any,
      });
      getCustomerByPhone.execute.mockResolvedValue({
        customer: mockCustomer,
      } as any);
      tokenService.decryptKey.mockReturnValue('decrypted-private-key');
      blockchainService.burn.mockResolvedValue({ txId: '0xtxhash123' } as any);
      transactionDBService.createTransaction.mockResolvedValue(
        mockTransaction as any,
      );
      updateCustomer.execute.mockRejectedValue(
        new Error('Balance update failed'),
      );

      // Act & Assert
      await expect(
        handler.execute(mockMerchantId, mockPointId, mockBurnData),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException if point not found', async () => {
      // Arrange
      getPointByIdHandler.execute.mockRejectedValue(
        new Error('Point not found'),
      );

      // Act & Assert
      await expect(
        handler.execute(mockMerchantId, mockPointId, mockBurnData),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException if private key decryption fails', async () => {
      // Arrange
      getPointByIdHandler.execute.mockResolvedValue({
        point: mockPoint as any,
      });
      getCustomerByPhone.execute.mockResolvedValue({
        customer: mockCustomer,
      } as any);
      tokenService.decryptKey.mockImplementation(() => {
        throw new Error('Decryption failed');
      });

      // Act & Assert
      await expect(
        handler.execute(mockMerchantId, mockPointId, mockBurnData),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('execute - edge cases', () => {
    it('should handle burn of entire balance', async () => {
      // Arrange
      getPointByIdHandler.execute.mockResolvedValue({
        point: mockPoint as any,
      });
      getCustomerByPhone.execute.mockResolvedValue({
        customer: mockCustomer,
      } as any);
      tokenService.decryptKey.mockReturnValue('decrypted-private-key');
      blockchainService.burn.mockResolvedValue({ txId: '0xtxhash123' } as any);
      transactionDBService.createTransaction.mockResolvedValue(
        mockTransaction as any,
      );
      updateCustomer.execute.mockResolvedValue({} as any);

      const burnAllData = {
        ...mockBurnData,
        amount: 1000, // Entire balance
      };

      // Act
      await handler.execute(mockMerchantId, mockPointId, burnAllData);

      // Assert
      expect(updateCustomer.execute).toHaveBeenCalledWith(mockCustomer.id, {
        customerPoints: {
          update: {
            where: { id: mockPointId }, // Handler uses cp.id === point.id
            data: { balances: 0 }, // 1000 - 1000 = 0
          },
        },
      });
    });

    it('should handle small burn amounts', async () => {
      // Arrange
      getPointByIdHandler.execute.mockResolvedValue({
        point: mockPoint as any,
      });
      getCustomerByPhone.execute.mockResolvedValue({
        customer: mockCustomer,
      } as any);
      tokenService.decryptKey.mockReturnValue('decrypted-private-key');
      blockchainService.burn.mockResolvedValue({ txId: '0xtxhash123' } as any);
      transactionDBService.createTransaction.mockResolvedValue(
        mockTransaction as any,
      );
      updateCustomer.execute.mockResolvedValue({} as any);

      const smallBurnData = {
        ...mockBurnData,
        amount: 1,
      };

      // Act
      await handler.execute(mockMerchantId, mockPointId, smallBurnData);

      // Assert
      expect(blockchainService.burn).toHaveBeenCalledWith({
        amount: 1,
        senderPrivateKey: 'decrypted-private-key',
        pointAddress: '0xPointContract123',
      });
      expect(updateCustomer.execute).toHaveBeenCalledWith(mockCustomer.id, {
        customerPoints: {
          update: {
            where: { id: mockPointId }, // Handler uses cp.id === point.id
            data: { balances: 999 }, // 1000 - 1
          },
        },
      });
    });
  });
});
