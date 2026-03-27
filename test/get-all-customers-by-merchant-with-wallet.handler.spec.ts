jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import { InternalServerErrorException } from '@nestjs/common';
import { GetAllCustomersByMerchantWithWallet } from 'src/modules/internal/customer/handlers/getAllCustomersByMerchantWithWallet.handler';
import { CustomerDBService } from 'src/modules/internal/customer/services/customer-db.service';

describe('GetAllCustomersByMerchantWithWallet', () => {
  let handler: GetAllCustomersByMerchantWithWallet;
  let dbService: jest.Mocked<CustomerDBService>;

  beforeEach(() => {
    dbService = {
      getAllCustomersByMerchantWithWallet: jest.fn(),
    } as any;

    handler = new GetAllCustomersByMerchantWithWallet(dbService);
    jest.clearAllMocks();
  });

  it('should return all customers with wallet and counts', async () => {
    dbService.getAllCustomersByMerchantWithWallet.mockResolvedValue({
      customers: [
        {
          id: 'cust-1',
          email: 'c1@test.com',
          firstName: 'Customer',
          lastName: 'One',
          tel: '0812345678',
          walletId: 'wallet-1',
          createdAt: new Date('2026-03-27T10:00:00.000Z'),
          updatedAt: new Date('2026-03-27T10:00:00.000Z'),
          wallet: {
            id: 'wallet-1',
            walletAddress: '0xabc',
            seedPhrase: 'encrypted-seed',
            chainCode: 'encrypted-chain',
            derivationIndex: 1,
            email: '',
            phoneNumber: '0812345678',
            type: 'customer',
            status: 'active',
          },
        },
      ],
      count: 1,
    } as any);

    const result = await handler.execute('merchant-1');

    expect(dbService.getAllCustomersByMerchantWithWallet).toHaveBeenCalledWith(
      'merchant-1',
    );
    expect(result).toEqual({
      customers: [
        expect.objectContaining({
          id: 'cust-1',
          wallet: expect.objectContaining({
            id: 'wallet-1',
            walletAddress: '0xabc',
          }),
        }),
      ],
      counts: 1,
    });
  });

  it('should throw InternalServerErrorException on service error', async () => {
    dbService.getAllCustomersByMerchantWithWallet.mockRejectedValue(
      new Error('db error'),
    );

    await expect(handler.execute('merchant-1')).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });
});
