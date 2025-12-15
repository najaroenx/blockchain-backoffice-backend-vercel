import { Test, TestingModule } from '@nestjs/testing';
import { MintTransaction } from '../src/modules/transaction/handlers/mintTransaction.handler';
import { TransactionDBService } from '../src/modules/transaction/services/transaction-db.service';
import { GetPointById } from '../src/modules/point/handlers/getPointById.handler';
import { BlockchainService } from '../src/providers/blockchain/blockchain.service';
import { GetCustomerPhone } from '../src/modules/customer/handlers/getCustomerByPhone.handler';
import { UpdateCustomer } from '../src/modules/customer/handlers/updateCustomer.handler';
import { ConfigService } from '@nestjs/config';
import { InternalServerErrorException } from '@nestjs/common';
import { TransactionTypeId } from '../src/constants/transaction-types.enum';
import { ADDRESS_ZERO } from '../src/constants';

describe('MintTransaction', () => {
  let handler: MintTransaction;
  let transactionDBService: jest.Mocked<TransactionDBService>;
  let getPointByIdHandler: jest.Mocked<GetPointById>;
  let blockchainService: jest.Mocked<BlockchainService>;
  let getCustomerByPhone: jest.Mocked<GetCustomerPhone>;
  let updateCustomer: jest.Mocked<UpdateCustomer>;

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

  const mockCustomerWithPoints = {
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
        id: 'cp-1',
        pointId: mockPointId,
        customerId: 'customer-123',
        balances: 500,
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

  const mockCustomerWithoutPoints = {
    ...mockCustomerWithPoints,
    customerPoints: [],
  };

  const mockCustomerWithDifferentPoint = {
    ...mockCustomerWithPoints,
    customerPoints: [
      {
        id: 'cp-other',
        pointId: 'other-point-id',
        customerId: 'customer-123',
        balances: 200,
      },
    ],
  };

  const mockTransaction = {
    id: 'transaction-789',
    merchantId: mockMerchantId,
    pointId: mockPointId,
    senderId: null,
    receiverId: mockCustomerWithPoints.id,
    amount: 100,
    transactionTypeId: TransactionTypeId.MINT,
    txHash: Buffer.from('0xtxhash123'.replace(/^0x/, ''), 'hex'),
    senderAddress: Buffer.from(ADDRESS_ZERO.replace(/^0x/, ''), 'hex'),
    receiverAddress: Buffer.from(
      mockCustomerWithPoints.wallet.walletAddress.replace(/^0x/, ''),
      'hex',
    ),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockMintData = {
    amount: 100,
    phone: '0801234567',
    transactionTypeId: TransactionTypeId.MINT,
    description: 'Mint tokens',
  };

  beforeEach(async () => {
    const mockTransactionDB = {
      createTransaction: jest.fn(),
    };

    const mockGetPointById = {
      execute: jest.fn(),
    };

    const mockBlockchain = {
      mint: jest.fn(),
    };

    const mockGetCustomer = {
      execute: jest.fn(),
    };

    const mockUpdateCustomerHandler = {
      execute: jest.fn(),
    };

    const mockConfig = {
      get: jest.fn().mockReturnValue(mockSalt),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MintTransaction,
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
          provide: ConfigService,
          useValue: mockConfig,
        },
      ],
    }).compile();

    handler = module.get<MintTransaction>(MintTransaction);
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
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute - successful mint with existing points', () => {
    it('should mint tokens to customer with existing point balance', async () => {
      // Arrange
      getPointByIdHandler.execute.mockResolvedValue({
        point: mockPoint as any,
      });
      getCustomerByPhone.execute.mockResolvedValue({
        customer: mockCustomerWithPoints,
      } as any);
      blockchainService.mint.mockResolvedValue({ txId: '0xtxhash123' } as any);
      transactionDBService.createTransaction.mockResolvedValue(
        mockTransaction as any,
      );
      updateCustomer.execute.mockResolvedValue({} as any);

      // Act
      const result = await handler.execute(
        mockMerchantId,
        mockPointId,
        mockMintData,
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
      expect(blockchainService.mint).toHaveBeenCalledWith({
        amount: 100,
        to: '0xCustomerWallet123',
        pointAddress: '0xPointContract123',
      });
      expect(transactionDBService.createTransaction).toHaveBeenCalled();
      expect(updateCustomer.execute).toHaveBeenCalledWith(
        mockCustomerWithPoints.id,
        {
          customerPoints: {
            update: {
              where: { id: 'cp-1' },
              data: { balances: 600 }, // 500 + 100
            },
          },
        },
      );
      expect(result).toHaveProperty('id', 'transaction-789');
      expect(result).toHaveProperty('txHash');
    });

    it('should update balance correctly with large mint amount', async () => {
      // Arrange
      getPointByIdHandler.execute.mockResolvedValue({
        point: mockPoint as any,
      });
      getCustomerByPhone.execute.mockResolvedValue({
        customer: mockCustomerWithPoints,
      } as any);
      blockchainService.mint.mockResolvedValue({ txId: '0xtxhash123' } as any);
      transactionDBService.createTransaction.mockResolvedValue(
        mockTransaction as any,
      );
      updateCustomer.execute.mockResolvedValue({} as any);

      const largeMintData = {
        ...mockMintData,
        amount: 5000,
      };

      // Act
      await handler.execute(mockMerchantId, mockPointId, largeMintData);

      // Assert
      expect(updateCustomer.execute).toHaveBeenCalledWith(
        mockCustomerWithPoints.id,
        {
          customerPoints: {
            update: {
              where: { id: 'cp-1' },
              data: { balances: 5500 }, // 500 + 5000
            },
          },
        },
      );
    });
  });

  describe('execute - successful mint without existing points', () => {
    it('should create new point balance when customer has no points', async () => {
      // Arrange
      getPointByIdHandler.execute.mockResolvedValue({
        point: mockPoint as any,
      });
      getCustomerByPhone.execute.mockResolvedValue({
        customer: mockCustomerWithoutPoints,
      } as any);
      blockchainService.mint.mockResolvedValue({ txId: '0xtxhash123' } as any);
      transactionDBService.createTransaction.mockResolvedValue(
        mockTransaction as any,
      );
      updateCustomer.execute.mockResolvedValue({} as any);

      // Act
      await handler.execute(mockMerchantId, mockPointId, mockMintData);

      // Assert
      expect(updateCustomer.execute).toHaveBeenCalledWith(
        mockCustomerWithoutPoints.id,
        {
          customerPoints: {
            create: { pointId: mockPointId, balances: 100 },
          },
        },
      );
    });

    it('should create new point balance when customer has different point type', async () => {
      // Arrange
      getPointByIdHandler.execute.mockResolvedValue({
        point: mockPoint as any,
      });
      getCustomerByPhone.execute.mockResolvedValue({
        customer: mockCustomerWithDifferentPoint,
      } as any);
      blockchainService.mint.mockResolvedValue({ txId: '0xtxhash123' } as any);
      transactionDBService.createTransaction.mockResolvedValue(
        mockTransaction as any,
      );
      updateCustomer.execute.mockResolvedValue({} as any);

      // Act
      await handler.execute(mockMerchantId, mockPointId, mockMintData);

      // Assert
      expect(updateCustomer.execute).toHaveBeenCalledWith(
        mockCustomerWithDifferentPoint.id,
        {
          customerPoints: {
            create: { pointId: mockPointId, balances: 100 },
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
        customer: mockCustomerWithPoints,
      } as any);
      blockchainService.mint.mockResolvedValue({ txId: '0xabcdef123' } as any);
      transactionDBService.createTransaction.mockResolvedValue(
        mockTransaction as any,
      );
      updateCustomer.execute.mockResolvedValue({} as any);

      // Act
      await handler.execute(mockMerchantId, mockPointId, mockMintData);

      // Assert
      expect(transactionDBService.createTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 100,
          description: 'Mint tokens',
          merchant: { connect: { id: mockMerchantId } },
          point: { connect: { id: mockPointId } },
          receiver: { connect: { id: mockCustomerWithPoints.id } },
          transactionType: { connect: { id: TransactionTypeId.MINT } },
          txHash: expect.any(Uint8Array),
          senderAddress: expect.any(Buffer),
          receiverAddress: expect.any(Uint8Array),
        }),
      );
    });

    it('should set sender address to ADDRESS_ZERO for mint', async () => {
      // Arrange
      getPointByIdHandler.execute.mockResolvedValue({
        point: mockPoint as any,
      });
      getCustomerByPhone.execute.mockResolvedValue({
        customer: mockCustomerWithPoints,
      } as any);
      blockchainService.mint.mockResolvedValue({ txId: '0xtxhash123' } as any);
      transactionDBService.createTransaction.mockResolvedValue(
        mockTransaction as any,
      );
      updateCustomer.execute.mockResolvedValue({} as any);

      // Act
      await handler.execute(mockMerchantId, mockPointId, mockMintData);

      // Assert
      const createCall = transactionDBService.createTransaction.mock.calls[0][0];
      const senderAddressBuffer = createCall.senderAddress as Buffer;
      const senderAddressHex = '0x' + senderAddressBuffer.toString('hex');

      expect(senderAddressHex.toLowerCase()).toBe(ADDRESS_ZERO.toLowerCase());
    });

    it('should include optional metadata in transaction', async () => {
      // Arrange
      const dataWithMetadata = {
        ...mockMintData,
        metadata: { campaign: 'welcome-bonus', source: 'referral' },
      };

      getPointByIdHandler.execute.mockResolvedValue({
        point: mockPoint as any,
      });
      getCustomerByPhone.execute.mockResolvedValue({
        customer: mockCustomerWithPoints,
      } as any);
      blockchainService.mint.mockResolvedValue({ txId: '0xtxhash123' } as any);
      transactionDBService.createTransaction.mockResolvedValue(
        mockTransaction as any,
      );
      updateCustomer.execute.mockResolvedValue({} as any);

      // Act
      await handler.execute(mockMerchantId, mockPointId, dataWithMetadata as any);

      // Assert
      expect(transactionDBService.createTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { campaign: 'welcome-bonus', source: 'referral' },
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
        handler.execute(mockMerchantId, mockPointId, mockMintData),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException if customer not registered with merchant', async () => {
      // Arrange
      const customerNotInMerchant = {
        ...mockCustomerWithPoints,
        customerMerChant: [
          {
            id: 'cm-other',
            merchantId: 'other-merchant-999',
            customerId: mockCustomerWithPoints.id,
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
        handler.execute(mockMerchantId, mockPointId, mockMintData),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException on blockchain RPC error', async () => {
      // Arrange
      getPointByIdHandler.execute.mockResolvedValue({
        point: mockPoint as any,
      });
      getCustomerByPhone.execute.mockResolvedValue({
        customer: mockCustomerWithPoints,
      } as any);
      blockchainService.mint.mockRejectedValue(
        new Error('500001: RPC server error'),
      );

      // Act & Assert
      await expect(
        handler.execute(mockMerchantId, mockPointId, mockMintData),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException on general blockchain error', async () => {
      // Arrange
      getPointByIdHandler.execute.mockResolvedValue({
        point: mockPoint as any,
      });
      getCustomerByPhone.execute.mockResolvedValue({
        customer: mockCustomerWithPoints,
      } as any);
      blockchainService.mint.mockRejectedValue(
        new Error('Blockchain network timeout'),
      );

      // Act & Assert
      await expect(
        handler.execute(mockMerchantId, mockPointId, mockMintData),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException if transaction creation fails', async () => {
      // Arrange
      getPointByIdHandler.execute.mockResolvedValue({
        point: mockPoint as any,
      });
      getCustomerByPhone.execute.mockResolvedValue({
        customer: mockCustomerWithPoints,
      } as any);
      blockchainService.mint.mockResolvedValue({ txId: '0xtxhash123' } as any);
      transactionDBService.createTransaction.mockRejectedValue(
        new Error('Database unique constraint violation'),
      );

      // Act & Assert
      await expect(
        handler.execute(mockMerchantId, mockPointId, mockMintData),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException if balance update fails', async () => {
      // Arrange
      getPointByIdHandler.execute.mockResolvedValue({
        point: mockPoint as any,
      });
      getCustomerByPhone.execute.mockResolvedValue({
        customer: mockCustomerWithPoints,
      } as any);
      blockchainService.mint.mockResolvedValue({ txId: '0xtxhash123' } as any);
      transactionDBService.createTransaction.mockResolvedValue(
        mockTransaction as any,
      );
      updateCustomer.execute.mockRejectedValue(new Error('Balance update failed'));

      // Act & Assert
      await expect(
        handler.execute(mockMerchantId, mockPointId, mockMintData),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException if point not found', async () => {
      // Arrange
      getPointByIdHandler.execute.mockRejectedValue(new Error('Point not found'));

      // Act & Assert
      await expect(
        handler.execute(mockMerchantId, mockPointId, mockMintData),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('execute - edge cases', () => {
    it('should handle minting to customer with zero balance', async () => {
      // Arrange
      const customerZeroBalance = {
        ...mockCustomerWithPoints,
        customerPoints: [
          {
            id: 'cp-1',
            pointId: mockPointId,
            customerId: 'customer-123',
            balances: 0,
          },
        ],
      };

      getPointByIdHandler.execute.mockResolvedValue({
        point: mockPoint as any,
      });
      getCustomerByPhone.execute.mockResolvedValue({
        customer: customerZeroBalance,
      } as any);
      blockchainService.mint.mockResolvedValue({ txId: '0xtxhash123' } as any);
      transactionDBService.createTransaction.mockResolvedValue(
        mockTransaction as any,
      );
      updateCustomer.execute.mockResolvedValue({} as any);

      // Act
      await handler.execute(mockMerchantId, mockPointId, mockMintData);

      // Assert
      expect(updateCustomer.execute).toHaveBeenCalledWith(customerZeroBalance.id, {
        customerPoints: {
          update: {
            where: { id: 'cp-1' },
            data: { balances: 100 }, // 0 + 100
          },
        },
      });
    });

    it('should handle small mint amounts', async () => {
      // Arrange
      getPointByIdHandler.execute.mockResolvedValue({
        point: mockPoint as any,
      });
      getCustomerByPhone.execute.mockResolvedValue({
        customer: mockCustomerWithPoints,
      } as any);
      blockchainService.mint.mockResolvedValue({ txId: '0xtxhash123' } as any);
      transactionDBService.createTransaction.mockResolvedValue(
        mockTransaction as any,
      );
      updateCustomer.execute.mockResolvedValue({} as any);

      const smallMintData = {
        ...mockMintData,
        amount: 1,
      };

      // Act
      await handler.execute(mockMerchantId, mockPointId, smallMintData);

      // Assert
      expect(blockchainService.mint).toHaveBeenCalledWith({
        amount: 1,
        to: '0xCustomerWallet123',
        pointAddress: '0xPointContract123',
      });
      expect(updateCustomer.execute).toHaveBeenCalledWith(
        mockCustomerWithPoints.id,
        {
          customerPoints: {
            update: {
              where: { id: 'cp-1' },
              data: { balances: 501 }, // 500 + 1
            },
          },
        },
      );
    });
  });
});
