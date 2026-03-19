jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));
jest.mock('src/libs/derive-wallet', () => ({
  deriveChildWallet: jest.fn(() => ({
    address: '0xmerchantwalletaddress',
    chainCode: 'child-chain-code',
  })),
}));

import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { CreateMerchant } from 'src/modules/internal/merchant/handlers/createMerchant.handler';
import { MerchantDBService } from 'src/modules/internal/merchant/services/merchant-db.service';
import { PrismaService } from 'prisma/prisma.service';
import { TokenService } from 'src/providers/token/token.service';
import { ConfigService } from '@nestjs/config';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';

describe('CreateMerchant', () => {
  let handler: CreateMerchant;
  let db: any;
  let prisma: any;
  let tokenService: any;
  let configService: any;
  let blockchainService: any;

  beforeEach(() => {
    db = {};
    prisma = {
      user: { findUnique: jest.fn() },
      wallet: { findFirst: jest.fn(), create: jest.fn() },
      merchant: { create: jest.fn() },
      $transaction: jest.fn(),
    };
    tokenService = {
      decryptKey: jest.fn(),
      encryptKey: jest.fn(),
      generateRandomString: jest.fn(),
    };
    configService = { get: jest.fn() };
    blockchainService = {
      isWhitelisted: jest.fn(),
      addToMarketplaceWhitelist: jest.fn(),
    };

    handler = new CreateMerchant(
      db as unknown as MerchantDBService,
      prisma as unknown as PrismaService,
      tokenService as unknown as TokenService,
      configService as unknown as ConfigService,
      blockchainService as unknown as BlockchainService,
    );
  });

  it('should throw BadRequestException when user not found', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      handler.execute('u1', { name: 'Test' } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException when user has no wallet', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', wallet: null });

    await expect(
      handler.execute('u1', { name: 'Test' } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException when phone already registered', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      wallet: { seedPhrase: 'enc-seed' },
      nextDerivationIndex: 0,
    });
    prisma.wallet.findFirst.mockResolvedValue({ id: 'existing-wallet' });

    await expect(
      handler.execute('u1', { name: 'Test', tel: '0891234567' } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('should create merchant with wallet and whitelist', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      wallet: { seedPhrase: 'enc-seed', id: 'w1' },
      nextDerivationIndex: 0,
    });
    prisma.wallet.findFirst.mockResolvedValue(null);
    configService.get.mockReturnValue('salt123');
    tokenService.decryptKey.mockReturnValue('decrypted-seed');
    tokenService.encryptKey.mockReturnValue('encrypted-chain-code');
    tokenService.generateRandomString.mockResolvedValue('generated-api-key');

    const mockMerchant = { id: 'm1', name: 'Test' };
    prisma.$transaction.mockImplementation(async (cb: any) => {
      return cb({
        wallet: { create: jest.fn().mockResolvedValue({ id: 'w2' }) },
        user: { update: jest.fn().mockResolvedValue({}) },
        merchant: { create: jest.fn().mockResolvedValue(mockMerchant) },
        apiKey: { create: jest.fn().mockResolvedValue({ id: 'k1' }) },
      });
    });

    blockchainService.isWhitelisted.mockResolvedValue(false);
    blockchainService.addToMarketplaceWhitelist.mockResolvedValue({});

    const result = await handler.execute('u1', { name: 'Test' } as any);

    expect(result).toBeDefined();
    expect(tokenService.generateRandomString).toHaveBeenCalled();
    expect(blockchainService.addToMarketplaceWhitelist).toHaveBeenCalledTimes(
      2,
    );
  });

  it('should succeed even when whitelist fails', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      wallet: { seedPhrase: 'enc', id: 'w1' },
      nextDerivationIndex: 0,
    });
    prisma.wallet.findFirst.mockResolvedValue(null);
    configService.get.mockReturnValue('salt');
    tokenService.decryptKey.mockReturnValue('seed');
    tokenService.encryptKey.mockReturnValue('enc');
    tokenService.generateRandomString.mockResolvedValue('generated-api-key');

    prisma.$transaction.mockImplementation(async (cb: any) =>
      cb({
        wallet: { create: jest.fn().mockResolvedValue({ id: 'w2' }) },
        user: { update: jest.fn().mockResolvedValue({}) },
        merchant: {
          create: jest.fn().mockResolvedValue({ id: 'm1', name: 'Test' }),
        },
        apiKey: { create: jest.fn().mockResolvedValue({ id: 'k1' }) },
      }),
    );

    blockchainService.isWhitelisted.mockRejectedValue(
      new Error('blockchain down'),
    );

    // Should not throw
    const result = await handler.execute('u1', { name: 'Test' } as any);
    expect(result).toBeDefined();
  });

  it('should fail the transaction when default api key creation fails', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      wallet: { seedPhrase: 'enc-seed', id: 'w1' },
      nextDerivationIndex: 0,
    });
    prisma.wallet.findFirst.mockResolvedValue(null);
    configService.get.mockReturnValue('salt123');
    tokenService.decryptKey.mockReturnValue('decrypted-seed');
    tokenService.encryptKey.mockReturnValue('encrypted-chain-code');
    tokenService.generateRandomString.mockResolvedValue('generated-api-key');

    prisma.$transaction.mockImplementation(async (cb: any) =>
      cb({
        wallet: { create: jest.fn().mockResolvedValue({ id: 'w2' }) },
        user: { update: jest.fn().mockResolvedValue({}) },
        merchant: {
          create: jest.fn().mockResolvedValue({ id: 'm1', name: 'Test' }),
        },
        apiKey: {
          create: jest
            .fn()
            .mockRejectedValue(new Error('api key create failed')),
        },
      }),
    );

    await expect(
      handler.execute('u1', { name: 'Test' } as any),
    ).rejects.toThrow(InternalServerErrorException);
  });

  it('should throw InternalServerErrorException on unexpected error', async () => {
    prisma.user.findUnique.mockRejectedValue(new Error('DB crash'));

    await expect(
      handler.execute('u1', { name: 'Test' } as any),
    ).rejects.toThrow(InternalServerErrorException);
  });
});
