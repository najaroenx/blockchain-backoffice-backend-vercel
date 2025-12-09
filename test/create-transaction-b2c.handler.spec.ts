import { Test, TestingModule } from '@nestjs/testing';
import { CreateTransactionB2C } from '../src/modules/transaction/handlers/createTransactionB2C.handler';
import { TransactionDBService } from '../src/modules/transaction/services/transaction-db.service';
import { BlockchainService } from '../src/providers/blockchain/blockchain.service';
import { GetCustomerPhone } from '../src/modules/customer/handlers/getCustomerByPhone.handler';
import { UpdateCustomer } from '../src/modules/customer/handlers/updateCustomer.handler';
import { CreateCustomer } from '../src/modules/customer/handlers/createCustomer.handler';
import { GetPointById } from '../src/modules/point/handlers/getPointById.handler';
import { GetMerchant } from '../src/modules/merchant/handlers/getMerchantById.handler';
import { TokenService } from '../src/providers/token/token.service';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import {
  MockDataFactory,
  createMockBlockchainService,
  createMockTokenService,
  createMockConfigService,
} from './fixtures';

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

      blockchainService.transferToken.mockResolvedValue({
        hash: '0xTRANSFER_TX_HASH',
      });

      transactionDBService.createTransaction.mockResolvedValue(mockTransaction);

      // Execute
      const result = await handler.execute(merchantId, pointId, {
        receiverPhone,
        amount,
      } as any);

      // Assertions
      expect(getMerchant.execute).toHaveBeenCalledWith(merchantId);
      expect(getPointById.execute).toHaveBeenCalledWith(pointId);
      expect(getCustomerByPhone.execute).toHaveBeenCalledWith(
        receiverPhone,
        merchantId,
      );

      expect(blockchainService.transferToken).toHaveBeenCalled();
      expect(transactionDBService.createTransaction).toHaveBeenCalled();

      expect(result).toMatchObject({
        transaction: expect.objectContaining({
          id: 'tx-123',
          amount,
        }),
      });
    });

    it('should auto-register customer when not found', async () => {
      const merchantId = 'merchant-123';
      const pointId = 'point-123';
      const receiverPhone = '0812345678';
      const amount = 100;

      const mockMerchant = MockDataFactory.createMockMerchant({
        id: merchantId,
      });

      const mockPoint = MockDataFactory.createMockPoint({
        id: pointId,
        merchantId,
      });

      const mockNewCustomer = MockDataFactory.createMockCustomer({
        id: 'new-customer-123',
        tel: receiverPhone,
      });

      const mockTransaction = MockDataFactory.createMockTransaction({
        amount,
      });

      // Setup mocks
      getMerchant.execute.mockResolvedValue({ merchant: mockMerchant });
      getPointById.execute.mockResolvedValue({ point: mockPoint });
      getCustomerByPhone.execute.mockResolvedValue({ customer: null });

      createCustomer.execute.mockResolvedValue({
        customer: mockNewCustomer,
      });

      blockchainService.transferToken.mockResolvedValue({
        hash: '0xTRANSFER_TX_HASH',
      });

      transactionDBService.createTransaction.mockResolvedValue(mockTransaction);

      // Execute
      const result = await handler.execute(merchantId, pointId, {
        receiverPhone,
        amount,
      } as any);

      // Assertions - Verify customer was auto-created
      expect(createCustomer.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          tel: receiverPhone,
        }),
        merchantId,
      );

      expect(blockchainService.transferToken).toHaveBeenCalled();
      expect(transactionDBService.createTransaction).toHaveBeenCalled();

      expect(result).toMatchObject({
        transaction: expect.any(Object),
      });
    });

    it('should add customerMerchant relationship if customer exists but not linked to merchant', async () => {
      const merchantId = 'merchant-123';
      const pointId = 'point-123';
      const receiverPhone = '0812345678';
      const amount = 100;

      const mockMerchant = MockDataFactory.createMockMerchant({
        id: merchantId,
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

      blockchainService.transferToken.mockResolvedValue({
        hash: '0xTRANSFER_TX_HASH',
      });

      transactionDBService.createTransaction.mockResolvedValue(mockTransaction);

      // Execute
      const result = await handler.execute(merchantId, pointId, {
        receiverPhone,
        amount,
      } as any);

      // Assertions - Verify customer relationship was created
      expect(updateCustomer.execute).toHaveBeenCalledWith(
        mockCustomer.id,
        expect.objectContaining({
          customerMerChant: expect.objectContaining({
            create: expect.arrayContaining([
              expect.objectContaining({
                merchantId,
              }),
            ]),
          }),
        }),
      );

      expect(result).toMatchObject({
        transaction: expect.any(Object),
      });
    });

    it('should throw BadRequestException when point does not belong to merchant', async () => {
      const merchantId = 'merchant-123';
      const pointId = 'point-123';

      const mockMerchant = MockDataFactory.createMockMerchant({
        id: merchantId,
      });

      const mockPoint = MockDataFactory.createMockPoint({
        id: pointId,
        merchantId: 'different-merchant', // Different merchant
      });

      getMerchant.execute.mockResolvedValue({ merchant: mockMerchant });
      getPointById.execute.mockResolvedValue({ point: mockPoint });

      await expect(
        handler.execute(merchantId, pointId, {
          receiverPhone: '0812345678',
          amount: 100,
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when amount is invalid', async () => {
      const merchantId = 'merchant-123';
      const pointId = 'point-123';

      const mockMerchant = MockDataFactory.createMockMerchant({
        id: merchantId,
      });

      const mockPoint = MockDataFactory.createMockPoint({
        id: pointId,
        merchantId,
      });

      getMerchant.execute.mockResolvedValue({ merchant: mockMerchant });
      getPointById.execute.mockResolvedValue({ point: mockPoint });

      await expect(
        handler.execute(merchantId, pointId, {
          receiverPhone: '0812345678',
          amount: 0, // Invalid amount
        } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
