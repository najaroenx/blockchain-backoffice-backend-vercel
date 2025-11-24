import { Test, TestingModule } from '@nestjs/testing';
import { GetCustomerListDev } from '../src/modules/customer/handlers/getCustomerListDev.handler';
import { CustomerDBService } from '../src/modules/customer/services/customer-db.service';
import { InternalServerErrorException } from '@nestjs/common';
import { PageOptionsDto } from '../src/common/dtos';

describe('GetCustomerListDev', () => {
  let handler: GetCustomerListDev;

  const mockCustomerDBService = {
    getAllCustomers: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetCustomerListDev,
        {
          provide: CustomerDBService,
          useValue: mockCustomerDBService,
        },
      ],
    }).compile();

    handler = module.get<GetCustomerListDev>(GetCustomerListDev);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should return all customers successfully', async () => {
    const pageOptionsDto = new PageOptionsDto();
    Object.assign(pageOptionsDto, {
      take: 10,
      page: 1,
    });

    const mockResult = {
      customers: [
        {
          id: '1',
          email: 'customer1@test.com',
          firstName: 'John',
          lastName: 'Doe',
          tel: '1234567890',
          createdAt: new Date(),
          updatedAt: new Date(),
          wallet: {
            walletAddress: '0x123',
          },
        },
        {
          id: '2',
          email: 'customer2@test.com',
          firstName: 'Jane',
          lastName: 'Smith',
          tel: '0987654321',
          createdAt: new Date(),
          updatedAt: new Date(),
          wallet: null,
        },
      ],
      count: 2,
    };

    mockCustomerDBService.getAllCustomers.mockResolvedValue(mockResult);

    const result = await handler.execute(pageOptionsDto);

    expect(result).toBeDefined();
    expect(result.customers).toBeDefined();
    expect(result.count).toBe(2);
    expect(result.customers.length).toBe(2);
    expect(result.customers[0].walletAddress).toBe('0x123');
    expect(result.customers[1].walletAddress).toBe('');
    expect(result.lower).toBe(0);
    expect(result.upper).toBe(1);
    expect(mockCustomerDBService.getAllCustomers).toHaveBeenCalledWith(
      pageOptionsDto,
    );
  });

  it('should return empty array when no customers found', async () => {
    const pageOptionsDto = new PageOptionsDto();
    Object.assign(pageOptionsDto, {
      take: 10,
      page: 1,
    });

    mockCustomerDBService.getAllCustomers.mockResolvedValue({
      customers: [],
      count: 0,
    });

    const result = await handler.execute(pageOptionsDto);

    expect(result).toBeDefined();
    expect(result.customers).toEqual([]);
    expect(result.count).toBe(0);
    expect(mockCustomerDBService.getAllCustomers).toHaveBeenCalledWith(
      pageOptionsDto,
    );
  });

  it('should handle pagination correctly', async () => {
    const pageOptionsDto = new PageOptionsDto();
    Object.assign(pageOptionsDto, {
      take: 5,
      page: 3,
    });

    const mockResult = {
      customers: [
        {
          id: '11',
          email: 'customer11@test.com',
          firstName: 'Test',
          lastName: 'User',
          tel: '1111111111',
          createdAt: new Date(),
          updatedAt: new Date(),
          wallet: {
            walletAddress: '0xabc',
          },
        },
      ],
      count: 25,
    };

    mockCustomerDBService.getAllCustomers.mockResolvedValue(mockResult);

    const result = await handler.execute(pageOptionsDto);

    expect(result).toBeDefined();
    expect(result.lower).toBe(10);
    expect(result.upper).toBe(14);
    expect(mockCustomerDBService.getAllCustomers).toHaveBeenCalledWith(
      pageOptionsDto,
    );
  });

  it('should throw InternalServerErrorException on error', async () => {
    const pageOptionsDto = new PageOptionsDto();
    Object.assign(pageOptionsDto, {
      take: 10,
      page: 1,
    });

    mockCustomerDBService.getAllCustomers.mockRejectedValue(
      new Error('Database error'),
    );

    await expect(handler.execute(pageOptionsDto)).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
