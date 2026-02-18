jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));
jest.mock('src/libs/convertBufferToAddress', () => ({
  convertBufferToAddress: jest.fn().mockReturnValue('0xMOCKED_ADDRESS'),
}));
import {
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { GetCustomerById } from 'src/modules/internal/customer/handlers/getCustomerById.handler';
import { CustomerDBService } from 'src/modules/internal/customer/services/customer-db.service';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';

describe('GetCustomerById', () => {
  let handler: GetCustomerById;
  let dbService: jest.Mocked<CustomerDBService>;
  let blockchainService: jest.Mocked<BlockchainService>;

  const mockCustomer = {
    id: 'customer-123',
    email: 'test@customer.com',
    firstName: 'Test',
    lastName: 'Customer',
    tel: '0987654321',
    wallet: { walletAddress: '0xCustomerWallet' },
    receivedTxns: [
      {
        id: 'tx-1',
        senderId: 'merchant-1',
        senderType: 'MERCHANT',
        receiverId: 'customer-123',
        receiverType: 'CUSTOMER',
        senderAddress: Buffer.from(
          '1234567890123456789012345678901234567890',
          'hex',
        ),
        receiverAddress: Buffer.from(
          'abcdefabcdefabcdefabcdefabcdefabcdefabcd',
          'hex',
        ),
        txHash: Buffer.from(
          'abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd',
          'hex',
        ),
        amount: 100,
        createdAt: new Date(),
        transactionTypeId: 'TRANSFER',
        merchant: { id: 'merchant-1', name: 'Merchant' },
      },
    ],
    sentTxns: [],
    customerPoints: [
      {
        point: {
          id: 'point-1',
          name: 'Test Points',
          symbol: 'TST',
          contractAddress: Buffer.from(
            '1234567890123456789012345678901234567890',
            'hex',
          ),
          imageUrl: 'https://example.com/point.png',
        },
      },
    ],
    customerMerChant: [],
  };

  beforeEach(() => {
    dbService = {
      getCustomerById: jest.fn(),
    } as any;

    blockchainService = {
      getBalance: jest.fn().mockResolvedValue({ balance: '500' }),
      provider: {} as any,
    } as any;

    handler = new GetCustomerById(dbService, blockchainService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should return formatted customer with transactions and points', async () => {
    dbService.getCustomerById.mockResolvedValue(mockCustomer as any);

    const result = await handler.execute('merchant-1', 'customer-123');

    expect(dbService.getCustomerById).toHaveBeenCalledWith(
      'merchant-1',
      'customer-123',
    );
    expect(result.customer).toBeDefined();
    expect(result.customer.walletAddress).toBe('0xCustomerWallet');
    expect(result.customer.transactions).toHaveLength(1);
    expect(result.customer.customerPoints).toHaveLength(1);
  });

  it('should throw NotFoundException when customer not found', async () => {
    dbService.getCustomerById.mockResolvedValue(null);

    await expect(handler.execute('merchant-1', 'nonexistent')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should throw InternalServerErrorException on unexpected error', async () => {
    dbService.getCustomerById.mockRejectedValue(new Error('DB failed'));

    await expect(handler.execute('merchant-1', 'customer-123')).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
