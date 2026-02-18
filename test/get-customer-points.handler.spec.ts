jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));
import {
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { GetCustomerPoints } from 'src/modules/internal/customer/handlers/getCustomerPoints.handler';
import { CustomerDBService } from 'src/modules/internal/customer/services/customer-db.service';

describe('GetCustomerPoints', () => {
  let handler: GetCustomerPoints;
  let dbService: jest.Mocked<CustomerDBService>;

  const mockCustomerData = {
    id: 'customer-123',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'Customer',
    tel: '0812345678',
    createdAt: new Date(),
    updatedAt: new Date(),
    wallet: { walletAddress: '0xWalletAddress' },
    customerMerChant: [
      {
        merchantId: 'merchant-1',
        merchant: {
          id: 'merchant-1',
          name: 'Test Merchant',
          description: 'Desc',
        },
      },
    ],
    customerPoints: [
      {
        point: {
          id: 'point-1',
          name: 'Loyalty Points',
          merchantId: 'merchant-1',
        },
        balances: '100',
      },
    ],
  };

  beforeEach(() => {
    dbService = {
      getCustomerByPhoneDetailed: jest.fn(),
    } as any;

    handler = new GetCustomerPoints(dbService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should return customer points grouped by merchant', async () => {
    dbService.getCustomerByPhoneDetailed.mockResolvedValue(
      mockCustomerData as any,
    );

    const result = await handler.execute('0812345678');

    expect(dbService.getCustomerByPhoneDetailed).toHaveBeenCalledWith(
      '0812345678',
    );
    expect(result.walletAddress).toBe('0xWalletAddress');
    expect(result.phone).toBe('0812345678');
    expect(result.customer.id).toBe('customer-123');
    expect(result.customer.merchants).toHaveLength(1);
    expect(result.customer.merchants[0].points).toHaveLength(1);
    expect(result.customer.merchants[0].points[0].title).toBe('Loyalty Points');
  });

  it('should throw NotFoundException when customer not found', async () => {
    dbService.getCustomerByPhoneDetailed.mockResolvedValue(null);

    await expect(handler.execute('0000000000')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should throw InternalServerErrorException on unexpected error', async () => {
    dbService.getCustomerByPhoneDetailed.mockRejectedValue(
      new Error('DB failed'),
    );

    await expect(handler.execute('0812345678')).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  it('should handle customer with no merchants', async () => {
    const customerNoMerchant = {
      ...mockCustomerData,
      customerMerChant: [],
      customerPoints: [],
    };
    dbService.getCustomerByPhoneDetailed.mockResolvedValue(
      customerNoMerchant as any,
    );

    const result = await handler.execute('0812345678');

    expect(result.customer.merchants).toHaveLength(0);
  });

  it('should handle customer without wallet', async () => {
    const customerNoWallet = {
      ...mockCustomerData,
      wallet: null,
    };
    dbService.getCustomerByPhoneDetailed.mockResolvedValue(
      customerNoWallet as any,
    );

    const result = await handler.execute('0812345678');

    expect(result.walletAddress).toBe('');
  });
});
