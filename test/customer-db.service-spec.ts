import { Test, TestingModule } from '@nestjs/testing';
import { CustomerDBService } from '../src/modules/internal/customer/services/customer-db.service';
import { CustomerRepository } from '../src/modules/internal/customer/customer.repository';
import { PrismaService } from '../prisma/prisma.service';
import { MockDataFactory, createMockPrismaClient } from './fixtures';

describe('CustomerDBService', () => {
  let service: CustomerDBService;
  let repository: any;
  let prisma: any;

  beforeEach(async () => {
    repository = {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findFirst: jest.fn(),
    };

    prisma = createMockPrismaClient();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerDBService,
        {
          provide: CustomerRepository,
          useValue: repository,
        },
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<CustomerDBService>(CustomerDBService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getCustomersByPhone', () => {
    it('should find customer by phone number', async () => {
      const phone = '0812345678';
      const merchantId = 'merchant-123';

      const mockCustomer = MockDataFactory.createMockCustomer({
        id: 'customer-123',
        tel: phone,
        customerMerChant: [{ merchantId }],
      });

      repository.findFirst.mockResolvedValue(mockCustomer);

      const result = await service.getCustomersByPhone(phone, merchantId);

      expect(repository.findFirst).toHaveBeenCalledWith({
        where: {
          tel: phone,
          customerMerChant: {
            some: { merchantId },
          },
        },
        include: expect.objectContaining({
          wallet: true,
          customerMerChant: true,
          customerPoints: true,
        }),
      });

      expect(result).toEqual(mockCustomer);
    });

    it('should return null when customer not found', async () => {
      const phone = '0899999999';
      const merchantId = 'merchant-123';

      repository.findFirst.mockResolvedValue(null);

      const result = await service.getCustomersByPhone(phone, merchantId);

      expect(result).toBeNull();
    });

    it('should find customer by phone without merchant filter', async () => {
      const phone = '0812345678';

      const mockCustomer = MockDataFactory.createMockCustomer({
        tel: phone,
      });

      repository.findFirst.mockResolvedValue(mockCustomer);

      const result = await service.getCustomersByPhone(phone);

      expect(repository.findFirst).toHaveBeenCalledWith({
        where: {
          tel: phone,
        },
        include: expect.any(Object),
      });

      expect(result).toEqual(mockCustomer);
    });
  });

  describe('getCustomersByMerchantId', () => {
    it('should return all customers for a merchant', async () => {
      const merchantId = 'merchant-123';

      const mockCustomers = [
        MockDataFactory.createMockCustomer({
          id: 'customer-1',
          firstName: 'John',
        }),
        MockDataFactory.createMockCustomer({
          id: 'customer-2',
          firstName: 'Jane',
        }),
      ];

      repository.findMany.mockResolvedValue(mockCustomers);

      const result = await service.getCustomersByMerchantId(merchantId);

      expect(repository.findMany).toHaveBeenCalledWith({
        where: {
          customerMerChant: {
            some: { merchantId },
          },
        },
        include: expect.objectContaining({
          wallet: true,
          customerPoints: true,
        }),
      });

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('customer-1');
      expect(result[1].id).toBe('customer-2');
    });

    it('should return empty array when merchant has no customers', async () => {
      const merchantId = 'merchant-no-customers';

      repository.findMany.mockResolvedValue([]);

      const result = await service.getCustomersByMerchantId(merchantId);

      expect(result).toEqual([]);
    });
  });

  describe('getCustomerById', () => {
    it('should find customer by ID', async () => {
      const customerId = 'customer-123';

      const mockCustomer = MockDataFactory.createMockCustomer({
        id: customerId,
        firstName: 'John',
        lastName: 'Doe',
      });

      repository.findUnique.mockResolvedValue(mockCustomer);

      const result = await service.getCustomerById(customerId);

      expect(repository.findUnique).toHaveBeenCalledWith({
        where: { id: customerId },
        include: expect.objectContaining({
          wallet: true,
          customerMerChant: true,
          customerPoints: true,
        }),
      });

      expect(result).toEqual(mockCustomer);
    });

    it('should return null when customer not found', async () => {
      const customerId = 'non-existent-id';

      repository.findUnique.mockResolvedValue(null);

      const result = await service.getCustomerById(customerId);

      expect(result).toBeNull();
    });
  });

  describe('createCustomer', () => {
    it('should create new customer with wallet', async () => {
      const customerData = {
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        tel: '0812345678',
      };

      const mockCustomer = MockDataFactory.createMockCustomer({
        ...customerData,
        id: 'customer-new',
      });

      repository.create.mockResolvedValue(mockCustomer);

      const result = await service.createCustomer(customerData);

      expect(repository.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: customerData.email,
          firstName: customerData.firstName,
          lastName: customerData.lastName,
          tel: customerData.tel,
        }),
      });

      expect(result).toEqual(mockCustomer);
    });
  });

  describe('updateCustomer', () => {
    it('should update customer information', async () => {
      const customerId = 'customer-123';
      const updateData = {
        firstName: 'Jane',
        lastName: 'Smith',
      };

      const mockUpdatedCustomer = MockDataFactory.createMockCustomer({
        id: customerId,
        ...updateData,
      });

      repository.update.mockResolvedValue(mockUpdatedCustomer);

      const result = await service.updateCustomer(customerId, updateData);

      expect(repository.update).toHaveBeenCalledWith({
        where: { id: customerId },
        data: updateData,
      });

      expect(result).toEqual(mockUpdatedCustomer);
    });
  });

  describe('deleteCustomer', () => {
    it('should delete customer by ID', async () => {
      const customerId = 'customer-123';

      const mockCustomer = MockDataFactory.createMockCustomer({
        id: customerId,
      });

      repository.delete.mockResolvedValue(mockCustomer);

      const result = await service.deleteCustomer(customerId);

      expect(repository.delete).toHaveBeenCalledWith({
        where: { id: customerId },
      });

      expect(result).toEqual(mockCustomer);
    });
  });

  describe('Customer Point Balance', () => {
    it('should get customer point balance for specific point ID', async () => {
      const customerId = 'customer-123';
      const pointId = 'point-123';

      const mockCustomerPoint = {
        id: 'cp-123',
        customerId,
        pointId,
        balances: 500,
      };

      prisma.customerPoint.findUnique.mockResolvedValue(mockCustomerPoint);

      const result = await service.getCustomerPointBalance(customerId, pointId);

      expect(prisma.customerPoint.findUnique).toHaveBeenCalledWith({
        where: {
          customerId_pointId: {
            customerId,
            pointId,
          },
        },
      });

      expect(result).toEqual(mockCustomerPoint);
    });

    it('should return null when customer has no balance for point', async () => {
      const customerId = 'customer-123';
      const pointId = 'point-999';

      prisma.customerPoint.findUnique.mockResolvedValue(null);

      const result = await service.getCustomerPointBalance(customerId, pointId);

      expect(result).toBeNull();
    });
  });
});
