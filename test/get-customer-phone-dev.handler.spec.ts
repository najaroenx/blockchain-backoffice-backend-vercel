jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));
import {
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { GetCustomerPhoneDevForResp } from 'src/modules/internal/customer/handlers/getCustomerPhoneDevForResp.handler';
import { CustomerDBService } from 'src/modules/internal/customer/services/customer-db.service';

describe('GetCustomerPhoneDevForResp', () => {
  let handler: GetCustomerPhoneDevForResp;
  let db: jest.Mocked<CustomerDBService>;

  const mockCustomer = {
    id: 'customer-1',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    tel: '0812345678',
    wallet: { walletAddress: '0xWallet123' },
    ownedVouchers: [
      {
        id: 'vc-1',
        code: 'CODE1',
        voucherId: 'v-1',
        voucherGroupId: 'vg-1',
        pointsCost: 50,
        currency: 'POINTS',
        isUsed: false,
        createdAt: new Date(),
        voucher: {
          id: 'v-1',
          name: 'Voucher 1',
          description: 'Test',
          imageUrl: null,
          value: 100,
          valueType: 'FIXED',
          status: 'active',
          endDate: new Date(Date.now() + 86400000),
          merchantId: 'merchant-1',
        },
      },
    ],
    customerPoints: [
      {
        balances: 100,
        point: {
          id: 'p-1',
          name: 'Test Points',
          symbol: 'TST',
          merchantId: 'merchant-1',
          imageUrl: null,
        },
      },
    ],
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
  };

  beforeEach(() => {
    db = {
      getCustomersByPhone: jest.fn(),
      getCustomerByPhoneDetailed: jest.fn(),
    } as any;
    handler = new GetCustomerPhoneDevForResp(db);
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should return formatted customer with grouped vouchers', async () => {
      db.getCustomersByPhone.mockResolvedValue(mockCustomer as any);

      const result = await handler.execute('merchant-1', '0812345678');

      expect(result.walletAddress).toBe('0xWallet123');
      expect(result.customerPoints).toHaveLength(1);
      expect(result.customerPoints[0].balance).toBe(100);
    });

    it('should throw NotFoundException when customer not found', async () => {
      db.getCustomersByPhone.mockResolvedValue(null);

      await expect(handler.execute('merchant-1', '0000000000')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw InternalServerErrorException on unexpected error', async () => {
      db.getCustomersByPhone.mockRejectedValue(new Error('DB failed'));

      await expect(handler.execute('merchant-1', '0812345678')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('executeDetailed', () => {
    it('should return detailed response with merchants grouped', async () => {
      const detailedCustomer = {
        ...mockCustomer,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      db.getCustomerByPhoneDetailed.mockResolvedValue(detailedCustomer as any);

      const result = await handler.executeDetailed('0812345678');

      expect(result.status).toBe(200);
      expect(result.data.customer.id).toBe('customer-1');
      expect(result.data.customer.merchants).toBeDefined();
    });

    it('should return 404 status when customer not found', async () => {
      db.getCustomerByPhoneDetailed.mockResolvedValue(null);

      const result = await handler.executeDetailed('0000000000');

      expect(result.status).toBe(404);
      expect(result.data).toBeNull();
    });

    it('should throw InternalServerErrorException on error', async () => {
      db.getCustomerByPhoneDetailed.mockRejectedValue(new Error('DB failed'));

      await expect(handler.executeDetailed('0812345678')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
