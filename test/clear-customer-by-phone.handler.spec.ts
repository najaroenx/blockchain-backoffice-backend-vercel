import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ClearCustomerByPhone } from '../src/modules/internal/customer/handlers/clearCustomerByPhone.handler';
import { CustomerDBService } from '../src/modules/internal/customer/services/customer-db.service';
import { PrismaService } from '../prisma/prisma.service';
import { CUSTOMER_NOT_FOUND } from '../src/errors/error.constants';

describe('ClearCustomerByPhone', () => {
  let handler: ClearCustomerByPhone;
  let customerDb: jest.Mocked<CustomerDBService>;
  let prisma: jest.Mocked<PrismaService>;

  const mockCustomer = {
    id: 'customer-123',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    tel: '0984360421',
    walletId: 'wallet-123',
    wallet: {
      id: 'wallet-123',
      walletAddress: '0x123',
      privateKey: 'encrypted-key',
      email: 'test@example.com',
      phoneNumber: '0984360421',
      type: 'customer',
      status: 'active',
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockCustomerDb = {
      getCustomerByPhoneDetailed: jest.fn(),
    };

    const mockPrisma = {
      $transaction: jest.fn(),
      voucherCode: {
        updateMany: jest.fn(),
      },
      customer: {
        delete: jest.fn(),
      },
      wallet: {
        delete: jest.fn(),
      },
      tempLinkCreateUser: {
        deleteMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClearCustomerByPhone,
        {
          provide: CustomerDBService,
          useValue: mockCustomerDb,
        },
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    handler = module.get<ClearCustomerByPhone>(ClearCustomerByPhone);
    customerDb = module.get(CustomerDBService);
    prisma = module.get(PrismaService);
  });

  describe('execute', () => {
    it('should successfully clear customer and all related data', async () => {
      // Arrange
      customerDb.getCustomerByPhoneDetailed.mockResolvedValue(mockCustomer);

      const mockTransaction = jest.fn().mockImplementation(async (callback) => {
        return await callback({
          voucherCode: {
            updateMany: jest.fn().mockResolvedValue({ count: 2 }),
          },
          customer: {
            delete: jest.fn().mockResolvedValue(mockCustomer),
          },
          wallet: {
            delete: jest.fn().mockResolvedValue(mockCustomer.wallet),
          },
          tempLinkCreateUser: {
            deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
        });
      });

      prisma.$transaction = mockTransaction as any;

      // Act
      const result = await handler.execute('0984360421');

      // Assert
      expect(result).toEqual({
        success: true,
        message: 'Customer cleared successfully',
        phone: '0984360421',
        customerId: 'customer-123',
      });

      expect(customerDb.getCustomerByPhoneDetailed).toHaveBeenCalledWith(
        '0984360421',
      );
      expect(mockTransaction).toHaveBeenCalled();
    });

    it('should throw NotFoundException when customer not found', async () => {
      // Arrange
      customerDb.getCustomerByPhoneDetailed.mockResolvedValue(null);

      // Act & Assert
      await expect(handler.execute('0999999999')).rejects.toThrow(
        NotFoundException,
      );
      await expect(handler.execute('0999999999')).rejects.toThrow(
        CUSTOMER_NOT_FOUND,
      );

      expect(customerDb.getCustomerByPhoneDetailed).toHaveBeenCalledWith(
        '0999999999',
      );
    });

    it('should clear customer without wallet', async () => {
      // Arrange
      const customerNoWallet = {
        ...mockCustomer,
        walletId: null,
        wallet: null,
      };

      customerDb.getCustomerByPhoneDetailed.mockResolvedValue(customerNoWallet);

      const walletDeleteMock = jest.fn();

      const mockTransaction = jest.fn().mockImplementation(async (callback) => {
        return await callback({
          voucherCode: {
            updateMany: jest.fn().mockResolvedValue({ count: 0 }),
          },
          customer: {
            delete: jest.fn().mockResolvedValue(customerNoWallet),
          },
          wallet: {
            delete: walletDeleteMock,
          },
          tempLinkCreateUser: {
            deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
          },
        });
      });

      prisma.$transaction = mockTransaction as any;

      // Act
      const result = await handler.execute('0984360421');

      // Assert
      expect(result.success).toBe(true);
      expect(walletDeleteMock).not.toHaveBeenCalled(); // Wallet delete should not be called
    });

    it('should handle transaction rollback on error', async () => {
      // Arrange
      customerDb.getCustomerByPhoneDetailed.mockResolvedValue(mockCustomer);

      const mockTransaction = jest.fn().mockImplementation(async () => {
        throw new Error('Database error');
      });

      prisma.$transaction = mockTransaction as any;

      // Act & Assert
      await expect(handler.execute('0984360421')).rejects.toThrow();

      expect(customerDb.getCustomerByPhoneDetailed).toHaveBeenCalledWith(
        '0984360421',
      );
      expect(mockTransaction).toHaveBeenCalled();
    });

    it('should clear voucher ownership and delete temp links', async () => {
      // Arrange
      customerDb.getCustomerByPhoneDetailed.mockResolvedValue(mockCustomer);

      const voucherUpdateMock = jest.fn().mockResolvedValue({ count: 3 });
      const tempLinkDeleteMock = jest.fn().mockResolvedValue({ count: 2 });

      const mockTransaction = jest.fn().mockImplementation(async (callback) => {
        return await callback({
          voucherCode: {
            updateMany: voucherUpdateMock,
          },
          customer: {
            delete: jest.fn().mockResolvedValue(mockCustomer),
          },
          wallet: {
            delete: jest.fn().mockResolvedValue(mockCustomer.wallet),
          },
          tempLinkCreateUser: {
            deleteMany: tempLinkDeleteMock,
          },
        });
      });

      prisma.$transaction = mockTransaction as any;

      // Act
      await handler.execute('0984360421');

      // Assert
      expect(tempLinkDeleteMock).toHaveBeenCalledWith({
        where: { phoneNumber: '0984360421' },
      });
    });
  });
});
