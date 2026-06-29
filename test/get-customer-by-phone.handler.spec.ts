jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));
import {
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { GetCustomerPhone } from 'src/modules/internal/customer/handlers/getCustomerByPhone.handler';
import { CustomerDBService } from 'src/modules/internal/customer/services/customer-db.service';
import { TempLinkDBService } from 'src/modules/internal/templink/service/templink-db.service';
import { OtpService } from 'src/modules/internal/otp/otp.service';

describe('GetCustomerPhone', () => {
  let handler: GetCustomerPhone;
  let db: jest.Mocked<CustomerDBService>;
  let tempLinkDB: jest.Mocked<TempLinkDBService>;
  let configService: any;
  let otpService: jest.Mocked<OtpService>;

  const mockCustomerWithWallet = {
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
        pointsCost: 50,
        currency: 'POINTS',
        isUsed: false,
        voucher: { id: 'v-1', name: 'Voucher 1' },
      },
    ],
    customerPoints: [],
    customerMerChant: [],
  };

  beforeEach(() => {
    db = {
      getCustomersByPhone: jest.fn(),
      getCustomerByPhoneDetailed: jest.fn(),
    } as any;
    tempLinkDB = {
      getTempLinkByPhoneNumber: jest.fn(),
      createTempLink: jest.fn(),
      updateTempLink: jest.fn(),
    } as any;
    configService = {
      get: jest.fn().mockReturnValue('http://localhost:3000'),
    };
    otpService = {
      generateOtp: jest.fn().mockReturnValue('123456'),
      hashOtp: jest.fn().mockReturnValue('hashed_123456'),
    } as any;
    handler = new GetCustomerPhone(db, tempLinkDB, configService, otpService);
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should return customer when found', async () => {
      db.getCustomersByPhone.mockResolvedValue(mockCustomerWithWallet as any);

      const result = await handler.execute('merchant-1', '0812345678');

      expect(result.customer.id).toBe('customer-1');
      expect(result.customer.walletAddress).toBe('0xWallet123');
      expect(result.customer.ownedVouchers).toHaveLength(1);
    });

    it('should add mock vouchers when customer has no owned vouchers', async () => {
      const customerNoVouchers = {
        ...mockCustomerWithWallet,
        ownedVouchers: [],
      };
      db.getCustomersByPhone.mockResolvedValue(customerNoVouchers as any);

      const result = await handler.execute('merchant-1', '0812345678');

      expect(result.customer.ownedVouchers.length).toBeGreaterThan(0);
    });

    it('should throw NotFoundException and create temp link when customer not found', async () => {
      db.getCustomersByPhone.mockResolvedValue(null);
      tempLinkDB.getTempLinkByPhoneNumber.mockResolvedValue(null);
      tempLinkDB.createTempLink.mockResolvedValue({} as any);

      await expect(handler.execute('merchant-1', '0000000000')).rejects.toThrow(
        NotFoundException,
      );
      expect(tempLinkDB.createTempLink).toHaveBeenCalled();
    });

    it('should reuse existing temp link when not expired', async () => {
      db.getCustomersByPhone.mockResolvedValue(null);
      tempLinkDB.getTempLinkByPhoneNumber.mockResolvedValue({
        uid: 'existing-uid',
        expire: new Date(Date.now() + 86400000),
      } as any);

      await expect(handler.execute('merchant-1', '0000000000')).rejects.toThrow(
        NotFoundException,
      );
      expect(tempLinkDB.createTempLink).not.toHaveBeenCalled();
    });

    it('should update expired temp link', async () => {
      db.getCustomersByPhone.mockResolvedValue(null);
      tempLinkDB.getTempLinkByPhoneNumber.mockResolvedValue({
        uid: 'old-uid',
        expire: new Date(Date.now() - 86400000),
      } as any);
      tempLinkDB.updateTempLink.mockResolvedValue({} as any);

      await expect(handler.execute('merchant-1', '0000000000')).rejects.toThrow(
        NotFoundException,
      );
      expect(tempLinkDB.updateTempLink).toHaveBeenCalled();
    });

    it('should throw InternalServerErrorException on unexpected error', async () => {
      db.getCustomersByPhone.mockRejectedValue(new Error('DB failed'));

      await expect(handler.execute('merchant-1', '0812345678')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('executeDetailed', () => {
    it('should return detailed customer info', async () => {
      const detailedCustomer = {
        id: 'customer-1',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        tel: '0812345678',
        wallet: { walletAddress: '0xWallet123' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      db.getCustomerByPhoneDetailed.mockResolvedValue(detailedCustomer as any);

      const result = await handler.executeDetailed('0812345678');

      expect(result.walletAddress).toBe('0xWallet123');
      expect(result.customer.id).toBe('customer-1');
    });

    it('should throw NotFoundException when not found', async () => {
      db.getCustomerByPhoneDetailed.mockResolvedValue(null);

      await expect(handler.executeDetailed('0000000000')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw InternalServerErrorException on error', async () => {
      db.getCustomerByPhoneDetailed.mockRejectedValue(new Error('DB failed'));

      await expect(handler.executeDetailed('0812345678')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
