jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));
jest.mock('src/libs/createWallet', () => ({
  createWallet: jest.fn(),
}));

import {
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateCustomer } from 'src/modules/internal/customer/handlers/createCustomer.handler';
import { CustomerDBService } from 'src/modules/internal/customer/services/customer-db.service';
import { createWallet } from 'src/libs/createWallet';

describe('CreateCustomer', () => {
  let handler: CreateCustomer;
  let db: jest.Mocked<CustomerDBService>;
  let tokenService: any;
  let configService: any;
  let prisma: any;

  const mockCustomer = {
    id: 'customer-1',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    tel: '0812345678',
    wallet: { walletAddress: '0xNewWallet' },
    customerMerChant: [{ merchantId: 'merchant-1' }],
  };

  beforeEach(() => {
    db = {
      getCustomersByEmail: jest.fn(),
      updateCustomer: jest.fn(),
    } as any;
    tokenService = {
      encryptKey: jest.fn().mockReturnValue('encrypted-data'),
    };
    configService = {
      get: jest.fn().mockReturnValue('test-salt'),
    };
    prisma = {
      merchant: { findUnique: jest.fn() },
      $transaction: jest.fn(),
    };
    handler = new CreateCustomer(db, tokenService, configService, prisma);
    jest.clearAllMocks();
  });

  it('should return existing customer when already associated with merchant', async () => {
    prisma.merchant.findUnique.mockResolvedValue({ id: 'merchant-1' });
    db.getCustomersByEmail.mockResolvedValue(mockCustomer as any);

    const result = await handler.execute('merchant-1', {
      email: 'test@example.com',
      tel: '0812345678',
    } as any);

    expect(result.id).toBe('customer-1');
    expect(result.walletAddress).toBe('0xNewWallet');
  });

  it('should associate existing customer with new merchant', async () => {
    const customerOtherMerchant = {
      ...mockCustomer,
      customerMerChant: [{ merchantId: 'other-merchant' }],
    };
    prisma.merchant.findUnique.mockResolvedValue({ id: 'merchant-1' });
    db.getCustomersByEmail
      .mockResolvedValueOnce(customerOtherMerchant as any)
      .mockResolvedValueOnce(mockCustomer as any);
    db.updateCustomer.mockResolvedValue({} as any);

    const result = await handler.execute('merchant-1', {
      email: 'test@example.com',
      tel: '0812345678',
    } as any);

    expect(db.updateCustomer).toHaveBeenCalled();
  });

  it('should create new customer with wallet via transaction', async () => {
    prisma.merchant.findUnique.mockResolvedValue({ id: 'merchant-1' });
    db.getCustomersByEmail.mockResolvedValue(null);
    (createWallet as jest.Mock).mockReturnValue({
      seedPhrase: 'seed words',
      walletAddress: '0xNewWallet',
      chainCode: 'chain-code',
      derivationIndex: 0,
    });
    prisma.$transaction.mockImplementation(async (cb: Function) => {
      const tx = {
        wallet: {
          create: jest.fn().mockResolvedValue({
            id: 'wallet-new',
            walletAddress: '0xNewWallet',
          }),
        },
        customer: {
          create: jest.fn().mockResolvedValue({
            id: 'customer-new',
            email: 'new@example.com',
            wallet: { walletAddress: '0xNewWallet' },
          }),
        },
      };
      return cb(tx);
    });

    const result = await handler.execute('merchant-1', {
      email: 'new@example.com',
      tel: '0811111111',
    } as any);

    expect(result.walletAddress).toBe('0xNewWallet');
  });

  it('should throw NotFoundException when merchant not found', async () => {
    prisma.merchant.findUnique.mockResolvedValue(null);

    await expect(
      handler.execute('nonexistent', {
        email: 'a@b.com',
        tel: '0812345678',
      } as any),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw InternalServerErrorException on unexpected error', async () => {
    prisma.merchant.findUnique.mockRejectedValue(new Error('DB failed'));

    await expect(
      handler.execute('merchant-1', {
        email: 'a@b.com',
        tel: '0812345678',
      } as any),
    ).rejects.toThrow(InternalServerErrorException);
  });
});
