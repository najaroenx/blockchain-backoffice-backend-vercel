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
import { CreateApiKey } from 'src/modules/internal/api-key/handlers/createApiKey.handler';
import { PrismaService } from 'prisma/prisma.service';
import { TokenService } from 'src/providers/token/token.service';
import { ConfigService } from '@nestjs/config';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';

describe('CreateMerchant', () => {
  let handler: CreateMerchant;
  let db: any;
  let createApiKey: any;
  let prisma: any;
  let tokenService: any;
  let configService: any;
  let blockchainService: any;

  beforeEach(() => {
    db = {};
    createApiKey = { execute: jest.fn() };
    prisma = {
      user: { findUnique: jest.fn() },
      wallet: { findFirst: jest.fn(), create: jest.fn() },
      merchant: { create: jest.fn() },
      $transaction: jest.fn(),
    };
    tokenService = { decryptKey: jest.fn(), encryptKey: jest.fn() };
    configService = { get: jest.fn() };
    blockchainService = {
      isWhitelisted: jest.fn(),
      addToMarketplaceWhitelist: jest.fn(),
    };

    handler = new CreateMerchant(
      db as unknown as MerchantDBService,
      createApiKey as unknown as CreateApiKey,
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

    const mockMerchant = { id: 'm1', name: 'Test' };
    prisma.$transaction.mockImplementation(async (cb: any) => {
      return { merchant: mockMerchant, sellerWalletAddress: '0xselleraddr' };
    });

    createApiKey.execute.mockResolvedValue({});
    blockchainService.isWhitelisted.mockResolvedValue(false);
    blockchainService.addToMarketplaceWhitelist.mockResolvedValue({});

    const result = await handler.execute('u1', { name: 'Test' } as any);

    expect(result).toBeDefined();
    expect(createApiKey.execute).toHaveBeenCalledWith('m1', {
      name: 'default api key',
    });
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

    prisma.$transaction.mockImplementation(async () => ({
      merchant: { id: 'm1', name: 'Test' },
      sellerWalletAddress: '0xsel',
    }));

    createApiKey.execute.mockResolvedValue({});
    blockchainService.isWhitelisted.mockRejectedValue(
      new Error('blockchain down'),
    );

    // Should not throw
    const result = await handler.execute('u1', { name: 'Test' } as any);
    expect(result).toBeDefined();
  });

  it('should throw InternalServerErrorException on unexpected error', async () => {
    prisma.user.findUnique.mockRejectedValue(new Error('DB crash'));

    await expect(
      handler.execute('u1', { name: 'Test' } as any),
    ).rejects.toThrow(InternalServerErrorException);
  });
});
