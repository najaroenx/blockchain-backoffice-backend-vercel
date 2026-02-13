import { Test, TestingModule } from '@nestjs/testing';
import { CreateTransactionB2C } from '../src/modules/internal/transaction/handlers/createTransactionB2C.handler';
import { TransactionDBService } from '../src/modules/internal/transaction/services/transaction-db.service';
import { BlockchainService } from '../src/providers/blockchain/blockchain.service';
import { GetCustomerPhone } from '../src/modules/internal/customer/handlers/getCustomerByPhone.handler';
import { UpdateCustomer } from '../src/modules/internal/customer/handlers/updateCustomer.handler';
import { CreateCustomer } from '../src/modules/internal/customer/handlers/createCustomer.handler';
import { GetPointById } from '../src/modules/internal/point/handlers/getPointById.handler';
import { GetMerchant } from '../src/modules/internal/merchant/handlers/getMerchantById.handler';
import { TokenService } from '../src/providers/token/token.service';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  MockDataFactory,
  createMockBlockchainService,
  createMockTokenService,
  createMockConfigService,
} from './fixtures';

jest.mock('src/libs/derive-wallet', () => ({
  getSignerFromSeedPhrase: jest.fn().mockReturnValue({
    privateKey:
      '0x1234567890123456789012345678901234567890123456789012345678901234',
    address: '0x2e988A386a799F506693793c6A5AF6B54dfAaBfB',
  }),
  deriveChildWallet: jest.fn(),
}));

jest.mock('ethers', () => ({
  ...jest.requireActual('ethers'),
  Wallet: class {
    constructor(pk: string) {
      (this as any).address = '0x2e988A386a799F506693793c6A5AF6B54dfAaBfB';
    }
  },
}));

describe('CreateTransactionB2C', () => {
  let handler: CreateTransactionB2C;
  let transactionDBService: any;
  let blockchainService: any;
  let getCustomerByPhone: any;
  let updateCustomer: any;
  let createCustomer: any;
  let getPointById: any;
  let getMerchant: any;
  let tokenService: any;
  let configService: any;

  beforeEach(async () => {
    transactionDBService = {
      createTransaction: jest.fn(),
    };

    blockchainService = createMockBlockchainService();
    tokenService = createMockTokenService();
    configService = createMockConfigService();

    // Ensure decryptKey returns valid private key
    tokenService.decryptKey.mockReturnValue(
      '0x1234567890123456789012345678901234567890123456789012345678901234',
    );

    getCustomerByPhone = {
      execute: jest.fn(),
    };

    updateCustomer = {
      execute: jest.fn(),
    };

    createCustomer = {
      execute: jest.fn(),
    };

    getPointById = {
      execute: jest.fn(),
    };

    getMerchant = {
      execute: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateTransactionB2C,
        {
          provide: TransactionDBService,
          useValue: transactionDBService,
        },
        {
          provide: BlockchainService,
          useValue: blockchainService,
        },
        {
          provide: GetCustomerPhone,
          useValue: getCustomerByPhone,
        },
        {
          provide: UpdateCustomer,
          useValue: updateCustomer,
        },
        {
          provide: CreateCustomer,
          useValue: createCustomer,
        },
        {
          provide: GetPointById,
          useValue: getPointById,
        },
        {
          provide: GetMerchant,
          useValue: getMerchant,
        },
        {
          provide: TokenService,
          useValue: tokenService,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    handler = module.get<CreateTransactionB2C>(CreateTransactionB2C);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  describe('execute', () => {
    it('should successfully transfer points to existing customer', async () => {
      const merchantId = 'merchant-123';
      const pointId = 'point-123';
      const receiverPhone = '0812345678';
      const amount = 100;

      const mockMerchant = MockDataFactory.createMockMerchant({
        id: merchantId,
        wallet: {
          walletAddress: '0x2e988A386a799F506693793c6A5AF6B54dfAaBfB',
          seedPhrase: 'encrypted-merchant-seed-phrase',
          derivationIndex: 0,
          privateKey:
            'encrypted-0x1234567890123456789012345678901234567890123456789012345678901234',
        },
      });

      const mockPoint = MockDataFactory.createMockPoint({
        id: pointId,
        merchantId,
        contractAddress: Buffer.from('POINT_ADDRESS', 'hex'),
      });

      const mockCustomer = MockDataFactory.createMockCustomer({
        id: 'customer-123',
        tel: receiverPhone,
        customerMerChant: [{ merchantId }],
      });

      const mockTransaction = MockDataFactory.createMockTransaction({
        id: 'tx-123',
        amount,
        pointId,
        merchantId,
      });

      // Setup mocks
      getMerchant.execute.mockResolvedValue({ merchant: mockMerchant });
      getPointById.execute.mockResolvedValue({ point: mockPoint });
      getCustomerByPhone.execute.mockResolvedValue({
        customer: mockCustomer,
      });

      blockchainService.transaction.mockResolvedValue({
        txId: '0xTRANSFER_TX_HASH',
      });

      transactionDBService.createTransaction.mockResolvedValue(mockTransaction);

      // Execute
      const result = await handler.execute(merchantId, pointId, {
        phone: receiverPhone,
        amount,
      } as any);

      // Assertions
      expect(getMerchant.execute).toHaveBeenCalledWith(merchantId);
      expect(getPointById.execute).toHaveBeenCalledWith(pointId, merchantId);
      expect(getCustomerByPhone.execute).toHaveBeenCalledWith(
        merchantId,
        receiverPhone,
      );

      expect(blockchainService.transaction).toHaveBeenCalled();
      expect(transactionDBService.createTransaction).toHaveBeenCalled();

      expect(result).toMatchObject({
        id: 'tx-123',
        amount,
      });
    });

    it('should auto-register customer when not found', async () => {
      const merchantId = 'merchant-123';
      const pointId = 'point-123';
      const receiverPhone = '0812345678';
      const amount = 100;

      const mockMerchant = MockDataFactory.createMockMerchant({
        id: merchantId,
        wallet: {
          walletAddress: '0x2e988A386a799F506693793c6A5AF6B54dfAaBfB',
          seedPhrase: 'encrypted-merchant-seed-phrase',
          derivationIndex: 0,
          privateKey:
            'encrypted-0x1234567890123456789012345678901234567890123456789012345678901234',
        },
      });

      const mockPoint = MockDataFactory.createMockPoint({
        id: pointId,
        merchantId,
      });

      const mockNewCustomer = MockDataFactory.createMockCustomer({
        id: 'new-customer-123',
        tel: receiverPhone,
        customerMerChant: [{ merchantId }],
      });

      const mockTransaction = MockDataFactory.createMockTransaction({
        amount,
      });

      // Setup mocks
      getMerchant.execute.mockResolvedValue({ merchant: mockMerchant });
      getPointById.execute.mockResolvedValue({ point: mockPoint });
      getCustomerByPhone.execute.mockResolvedValue({
        message: 'Customer not found',
      });

      createCustomer.execute.mockResolvedValue(mockNewCustomer);

      blockchainService.transaction.mockResolvedValue({
        txId: '0xTRANSFER_TX_HASH',
      });

      transactionDBService.createTransaction.mockResolvedValue(mockTransaction);

      // Execute
      const result = await handler.execute(merchantId, pointId, {
        phone: receiverPhone,
        amount,
      } as any);

      // Assertions - Verify customer was auto-created
      expect(createCustomer.execute).toHaveBeenCalledWith(
        merchantId,
        expect.objectContaining({
          tel: receiverPhone,
        }),
      );

      expect(blockchainService.transaction).toHaveBeenCalled();
      expect(transactionDBService.createTransaction).toHaveBeenCalled();

      expect(result).toBeDefined();
    });

    it('should add customerMerchant relationship if customer exists but not linked to merchant', async () => {
      const merchantId = 'merchant-123';
      const pointId = 'point-123';
      const receiverPhone = '0812345678';
      const amount = 100;

      const mockMerchant = MockDataFactory.createMockMerchant({
        id: merchantId,
        wallet: {
          walletAddress: '0x2e988A386a799F506693793c6A5AF6B54dfAaBfB',
          seedPhrase: 'encrypted-merchant-seed-phrase',
          derivationIndex: 0,
          privateKey:
            'encrypted-0x1234567890123456789012345678901234567890123456789012345678901234',
        },
      });

      const mockPoint = MockDataFactory.createMockPoint({
        id: pointId,
        merchantId,
      });

      const mockCustomer = MockDataFactory.createMockCustomer({
        id: 'customer-123',
        tel: receiverPhone,
        customerMerChant: [], // Not linked to merchant yet
      });

      const mockTransaction = MockDataFactory.createMockTransaction({
        amount,
      });

      // Setup mocks
      getMerchant.execute.mockResolvedValue({ merchant: mockMerchant });
      getPointById.execute.mockResolvedValue({ point: mockPoint });
      getCustomerByPhone.execute.mockResolvedValue({
        customer: mockCustomer,
      });

      updateCustomer.execute.mockResolvedValue({
        customer: mockCustomer,
      });

      blockchainService.transaction.mockResolvedValue({
        txId: '0xTRANSFER_TX_HASH',
      });

      transactionDBService.createTransaction.mockResolvedValue(mockTransaction);

      // Execute
      const result = await handler.execute(merchantId, pointId, {
        phone: receiverPhone,
        amount,
      } as any);

      // Assertions - Verify customer relationship was created
      expect(updateCustomer.execute).toHaveBeenCalledWith(
        mockCustomer.id,
        expect.objectContaining({
          customerMerChant: expect.objectContaining({
            create: expect.objectContaining({
              merchantId,
            }),
          }),
        }),
      );

      expect(result).toBeDefined();
    });

    it('should throw BadRequestException when point does not belong to merchant', async () => {
      const merchantId = 'merchant-123';
      const pointId = 'point-123';

      const mockMerchant = MockDataFactory.createMockMerchant({
        id: merchantId,
        wallet: {
          walletAddress: '0x2e988A386a799F506693793c6A5AF6B54dfAaBfB',
          seedPhrase: 'encrypted-merchant-seed-phrase',
          derivationIndex: 0,
          privateKey:
            'encrypted-0x1234567890123456789012345678901234567890123456789012345678901234',
        },
      });

      getMerchant.execute.mockResolvedValue({ merchant: mockMerchant });
      // When point doesn't belong to merchant, getPointById throws NotFoundException
      getPointById.execute.mockRejectedValue(
        new NotFoundException('Point not found'),
      );

      await expect(
        handler.execute(merchantId, pointId, {
          phone: '0812345678',
          amount: 100,
        } as any),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when merchant has insufficient balance', async () => {
      const merchantId = 'merchant-123';
      const pointId = 'point-123';

      const mockMerchant = MockDataFactory.createMockMerchant({
        id: merchantId,
        wallet: {
          walletAddress: '0x2e988A386a799F506693793c6A5AF6B54dfAaBfB',
          seedPhrase: 'encrypted-merchant-seed-phrase',
          derivationIndex: 0,
          privateKey:
            'encrypted-0x1234567890123456789012345678901234567890123456789012345678901234',
        },
      });

      const mockPoint = MockDataFactory.createMockPoint({
        id: pointId,
        merchantId,
      });

      const mockCustomer = MockDataFactory.createMockCustomer({
        id: 'customer-123',
        tel: '0812345678',
        customerMerChant: [{ merchantId }],
      });

      getMerchant.execute.mockResolvedValue({ merchant: mockMerchant });
      getPointById.execute.mockResolvedValue({ point: mockPoint });
      getCustomerByPhone.execute.mockResolvedValue({ customer: mockCustomer });
      // Mock insufficient balance - merchant has 50 but needs 100
      blockchainService.getBalance.mockResolvedValue({ balance: '50', balanceWei: '50000000000000000000' });

      await expect(
        handler.execute(merchantId, pointId, {
          phone: '0812345678',
          amount: 100, // Request more than available
        } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
