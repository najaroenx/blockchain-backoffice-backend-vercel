jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));
import { InternalServerErrorException } from '@nestjs/common';
import { GetCustomersByMerchantId } from 'src/modules/internal/customer/handlers/getCustomersByMerchantId.handler';
import { CustomerDBService } from 'src/modules/internal/customer/services/customer-db.service';

describe('GetCustomersByMerchantId', () => {
  let handler: GetCustomersByMerchantId;
  let dbService: jest.Mocked<CustomerDBService>;

  const mockCustomers = [
    {
      id: 'cust-1',
      email: 'c1@test.com',
      firstName: 'Customer',
      lastName: 'One',
      wallet: { walletAddress: '0xCust1' },
    },
    {
      id: 'cust-2',
      email: 'c2@test.com',
      firstName: 'Customer',
      lastName: 'Two',
      wallet: null,
    },
  ];

  beforeEach(() => {
    dbService = {
      getCustomersByMerchant: jest.fn(),
    } as any;

    handler = new GetCustomersByMerchantId(dbService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should return formatted customers with pagination', async () => {
    dbService.getCustomersByMerchant.mockResolvedValue({
      customers: mockCustomers,
      count: 2,
    } as any);

    const pageOptions = { skip: 0, take: 10 } as any;
    const result = await handler.execute('merchant-1', pageOptions);

    expect(dbService.getCustomersByMerchant).toHaveBeenCalledWith(
      'merchant-1',
      pageOptions,
    );
    expect(result.customers).toHaveLength(2);
    expect(result.customers[0].walletAddress).toBe('0xCust1');
    expect(result.customers[1].walletAddress).toBe('');
    expect(result.counts).toBe(2);
    expect(result.lower).toBe(0);
    expect(result.upper).toBe(9);
  });

  it('should return empty list when no customers found', async () => {
    dbService.getCustomersByMerchant.mockResolvedValue({
      customers: [],
      count: 0,
    } as any);

    const pageOptions = { skip: 0, take: 10 } as any;
    const result = await handler.execute('merchant-1', pageOptions);

    expect(result.customers).toHaveLength(0);
    expect(result.counts).toBe(0);
  });

  it('should throw InternalServerErrorException on error', async () => {
    dbService.getCustomersByMerchant.mockRejectedValue(new Error('DB failed'));

    const pageOptions = { skip: 0, take: 10 } as any;
    await expect(handler.execute('merchant-1', pageOptions)).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  it('should calculate correct pagination bounds', async () => {
    dbService.getCustomersByMerchant.mockResolvedValue({
      customers: mockCustomers,
      count: 50,
    } as any);

    const pageOptions = { skip: 20, take: 10 } as any;
    const result = await handler.execute('merchant-1', pageOptions);

    expect(result.lower).toBe(20);
    expect(result.upper).toBe(29);
  });
});
