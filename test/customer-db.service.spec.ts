import { Test, TestingModule } from '@nestjs/testing';
import { CustomerDBService } from '../src/modules/internal/customer/services/customer-db.service';
import { CustomerRepository } from '../src/modules/internal/customer/customer.repository';
import { PrismaService } from '../prisma/prisma.service';
import { Customer, CustomerPoint, Point, Prisma } from '@prisma/client';
import { PageOptionsDto } from '../src/common/dtos';

describe('CustomerDBService', () => {
  let service: CustomerDBService;
  let repository: jest.Mocked<CustomerRepository>;
  let prisma: any;

  const mockCustomer: Customer = {
    id: 'customer-1',
    walletId: 'wallet-1',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    tel: '0812345678',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockWallet = {
    id: 'wallet-1',
    address: Buffer.from('0x1234567890123456789012345678901234567890', 'hex'),
    privateKey: 'encrypted-key',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPoint: Point = {
    id: 'point-1',
    merchantId: 'merchant-1',
    name: 'Test Point',
    symbol: 'TST',
    decimal: 18,
    initialSupply: 1000000,
    contractAddress: Buffer.from(
      '0x1111111111111111111111111111111111111111',
      'hex',
    ),
    startDate: new Date(),
    endDate: new Date(Date.now() + 86400000),
    epochDuration: 259200,
    imageUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCustomerPoint: CustomerPoint = {
    id: 'cp-1',
    customerId: 'customer-1',
    pointId: 'point-1',
    balances: 100,
  };

  beforeEach(async () => {
    const mockRepository = {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerDBService,
        {
          provide: CustomerRepository,
          useValue: mockRepository,
        },
        {
          provide: PrismaService,
          useValue: { customer: { findFirst: jest.fn(), findUnique: jest.fn() }, voucherCode: { findMany: jest.fn().mockResolvedValue([]) }, $queryRaw: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<CustomerDBService>(CustomerDBService);
    repository = module.get(CustomerRepository);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createCustomer', () => {
    it('should create a new customer successfully', async () => {
      const createData: Omit<Prisma.CustomerCreateInput, 'transaction'> = {
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        tel: '0812345678',
      };

      repository.create.mockResolvedValue(mockCustomer);

      const result = await service.createCustomer(createData);

      expect(result).toEqual(mockCustomer);
      expect(repository.create).toHaveBeenCalledWith({
        data: createData,
        select: {
          id: true,
          walletId: true,
          email: true,
          firstName: true,
          lastName: true,
          tel: true,
        },
      });
    });

    it('should throw error if repository.create fails', async () => {
      const createData: Omit<Prisma.CustomerCreateInput, 'transaction'> = {
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        tel: '0812345678',
      };

      repository.create.mockRejectedValue(new Error('Database error'));

      await expect(service.createCustomer(createData)).rejects.toThrow(
        'Database error',
      );
    });
  });

  describe('updateCustomer', () => {
    it('should update customer successfully', async () => {
      const updateData: Prisma.CustomerUpdateInput = {
        firstName: 'Jane',
        lastName: 'Smith',
      };

      const updatedCustomer = {
        ...mockCustomer,
        firstName: 'Jane',
        lastName: 'Smith',
      };
      repository.update.mockResolvedValue(updatedCustomer);

      const result = await service.updateCustomer('customer-1', updateData);

      expect(result).toEqual(updatedCustomer);
      expect(repository.update).toHaveBeenCalledWith({
        where: { id: 'customer-1' },
        data: updateData,
      });
    });

    it('should throw error if customer not found', async () => {
      const updateData: Prisma.CustomerUpdateInput = {
        firstName: 'Jane',
      };

      repository.update.mockRejectedValue(new Error('Customer not found'));

      await expect(
        service.updateCustomer('invalid-id', updateData),
      ).rejects.toThrow('Customer not found');
    });
  });

  describe('getCustomersByMerchant', () => {
    it('should return customers with pagination', async () => {
      const pageOptionsDto = {
        page: 1,
        take: 10,
      } as PageOptionsDto;

      const customersWithWallet = [{ ...mockCustomer, wallet: mockWallet }];
      repository.count.mockResolvedValue(1);
      repository.findMany.mockResolvedValue(customersWithWallet);

      const result = await service.getCustomersByMerchant(
        'merchant-1',
        pageOptionsDto,
      );

      expect(result.customers).toEqual(customersWithWallet);
      expect(result.count).toBe(1);
      expect(repository.count).toHaveBeenCalledWith({
        where: {
          customerMerChant: {
            some: {
              merchantId: 'merchant-1',
            },
          },
        },
      });
      expect(repository.findMany).toHaveBeenCalledWith({
        where: {
          customerMerChant: {
            some: {
              merchantId: 'merchant-1',
            },
          },
        },
        take: 10,
        skip: pageOptionsDto.skip,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          wallet: true,
        },
      });
    });

    it('should return empty array when no customers found', async () => {
      const pageOptionsDto = {
        page: 1,
        take: 10,
      } as PageOptionsDto;

      repository.count.mockResolvedValue(0);
      repository.findMany.mockResolvedValue([]);

      const result = await service.getCustomersByMerchant(
        'merchant-1',
        pageOptionsDto,
      );

      expect(result.customers).toEqual([]);
      expect(result.count).toBe(0);
    });

    it('should handle pagination with skip and take', async () => {
      const pageOptionsDto = {
        page: 2,
        take: 5,
      } as PageOptionsDto;

      repository.count.mockResolvedValue(15);
      repository.findMany.mockResolvedValue([mockCustomer]);

      await service.getCustomersByMerchant('merchant-1', pageOptionsDto);

      expect(repository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: pageOptionsDto.skip,
          take: 5,
        }),
      );
    });
  });

  describe('getCustomersByEmail', () => {
    it('should return customer with points and merchant relationship', async () => {
      const customerWithRelations = {
        ...mockCustomer,
        wallet: mockWallet,
        customerPoints: [{ ...mockCustomerPoint, point: mockPoint }],
        customerMerChant: [
          {
            id: 'cm-1',
            merchantId: 'merchant-1',
            customerId: 'customer-1',
          },
        ],
      };

      repository.findFirst.mockResolvedValue(customerWithRelations);

      const result = await service.getCustomersByEmail(
        'merchant-1',
        'test@example.com',
      );

      expect(result).toEqual(customerWithRelations);
      expect(repository.findFirst).toHaveBeenCalledWith({
        where: {
          email: 'test@example.com',
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          wallet: true,
          customerMerChant: {
            select: {
              id: true,
              merchantId: true,
              customerId: true,
            },
          },
          customerPoints: {
            where: {
              customer: {
                email: 'test@example.com',
              },
              point: {
                merchant: {
                  id: 'merchant-1',
                },
              },
            },
          },
        },
      });
    });

    it('should return null when customer not found', async () => {
      repository.findFirst.mockResolvedValue(null);

      const result = await service.getCustomersByEmail(
        'merchant-1',
        'notfound@example.com',
      );

      expect(result).toBeNull();
    });

    it('should filter customer points by merchant ID', async () => {
      const merchantId = 'merchant-2';
      repository.findFirst.mockResolvedValue(null);

      await service.getCustomersByEmail(merchantId, 'test@example.com');

      expect(repository.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            customerPoints: expect.objectContaining({
              where: expect.objectContaining({
                point: {
                  merchant: {
                    id: merchantId,
                  },
                },
              }),
            }),
          }),
        }),
      );
    });
  });

  describe('getCustomersByPhone', () => {
    it('should return customer with all relationships by phone', async () => {
      const customerWithRelations = {
        ...mockCustomer,
        wallet: mockWallet,
        customerPoints: [{ ...mockCustomerPoint, point: mockPoint }],
        customerMerChant: [
          {
            id: 'cm-1',
            merchantId: 'merchant-1',
            customerId: 'customer-1',
            merchant: {
              id: 'merchant-1',
              name: 'Test Merchant',
              walletId: 'wallet-2',
              location: 'Bangkok',
              website: 'https://test.com',
              tel: '0887654321',
              description: 'Test description',
              imageUrl: 'https://test.com/image.png',
              points: 0,
              voucherIds: [],
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          },
        ],
        ownedVouchers: [],
      };

      repository.findFirst.mockResolvedValue(customerWithRelations);

      const result = await service.getCustomersByPhone(
        'merchant-1',
        '0812345678',
      );

      expect(result).toEqual(customerWithRelations);
      expect(repository.findFirst).toHaveBeenCalledWith({
        where: {
          tel: '0812345678',
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          wallet: true,
          customerMerChant: {
            select: {
              id: true,
              merchantId: true,
              customerId: true,
              merchant: {
                select: {
                  id: true,
                  name: true,
                  description: true,
                  imageUrl: true,
                  location: true,
                  website: true,
                  tel: true,
                },
              },
            },
          },
          customerPoints: {
            where: {
              customer: {
                tel: '0812345678',
              },
            },
            select: {
              balances: true,
              id: true,
              pointId: true,
              point: {
                select: {
                  id: true,
                  name: true,
                  symbol: true,
                  merchantId: true,
                  imageUrl: true,
                },
              },
            },
          },
        },
      });
    });

    it('should return null when phone not found', async () => {
      repository.findFirst.mockResolvedValue(null);

      const result = await service.getCustomersByPhone(
        'merchant-1',
        '0899999999',
      );

      expect(result).toBeNull();
    });

    it('should include owned vouchers in the response', async () => {
      const customerWithVouchers = {
        ...mockCustomer,
        wallet: mockWallet,
        customerPoints: [],
        customerMerChant: [],
      };

      repository.findFirst.mockResolvedValue(customerWithVouchers);

      // Override voucherCode.findMany to return voucher codes for this test
      prisma.voucherCode.findMany.mockResolvedValue([
        {
          id: 'vc-1',
          voucherId: 'voucher-1',
          customerId: 'customer-1',
          code: 'VOUCHER123',
          isUsed: false,
          usedAt: null,
          expiresAt: new Date(Date.now() + 86400000),
          createdAt: new Date(),
          updatedAt: new Date(),
          isDeactivated: false,
        },
      ]);

      const result = await service.getCustomersByPhone(
        'merchant-1',
        '0812345678',
      );

      expect(result.ownedVouchers).toHaveLength(1);
      expect(result.ownedVouchers[0].code).toBe('VOUCHER123');
    });
  });
});
