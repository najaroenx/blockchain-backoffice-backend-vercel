jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));
jest.mock('src/libs/createWallet', () => ({
  createWallet: jest.fn(),
}));

import {
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AuthService } from 'src/modules/internal/auth/services/auth.service';
import { compare, hash } from 'bcrypt';
import { createWallet } from 'src/libs/createWallet';

describe('AuthService', () => {
  let service: AuthService;
  let tokenService: any;
  let createSessionHandler: any;
  let getSessionByToken: any;
  let userDBService: any;
  let configService: any;
  let prisma: any;

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    password: '$2b$10$hashedpassword',
    walletId: 'wallet-1',
    nextDerivationIndex: 1,
  };

  beforeEach(() => {
    tokenService = {
      generateRandomString: jest.fn().mockResolvedValue('random-token-30chars'),
      signJwt: jest.fn().mockResolvedValue('jwt-access-token'),
      encryptKey: jest.fn().mockReturnValue('encrypted-data'),
    };
    createSessionHandler = {
      execute: jest.fn().mockResolvedValue({ id: 'session-1' }),
    };
    getSessionByToken = {
      execute: jest.fn(),
    };
    userDBService = {
      getUserByEmail: jest.fn(),
    };
    configService = {
      get: jest.fn().mockReturnValue('test-salt'),
    };
    prisma = {
      $transaction: jest.fn(),
    };

    service = new AuthService(
      tokenService,
      createSessionHandler,
      getSessionByToken,
      userDBService,
      configService,
      prisma,
    );

    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should login and return tokens', async () => {
      userDBService.getUserByEmail.mockResolvedValue(mockUser);
      (compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login('test@example.com', 'password123');

      expect(result.accessToken).toBe('jwt-access-token');
      expect(result.refreshToken).toBe('random-token-30chars');
      expect(createSessionHandler.execute).toHaveBeenCalled();
    });

    it('should throw NotFoundException when user not found', async () => {
      userDBService.getUserByEmail.mockResolvedValue(null);

      await expect(
        service.login('notfound@example.com', 'password'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw InternalServerErrorException on wrong password', async () => {
      userDBService.getUserByEmail.mockResolvedValue(mockUser);
      (compare as jest.Mock).mockResolvedValue(false);

      // Handler wraps UnauthorizedException into InternalServerErrorException
      await expect(
        service.login('test@example.com', 'wrong-password'),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('register', () => {
    it('should register user with wallet', async () => {
      userDBService.getUserByEmail.mockResolvedValue(null);
      (hash as jest.Mock).mockResolvedValue('hashed-password');
      (createWallet as jest.Mock).mockReturnValue({
        walletAddress: '0xNewWallet',
        seedPhrase: 'seed phrase words',
        chainCode: 'chain-code',
      });
      prisma.$transaction.mockImplementation(async (cb: Function) => {
        const tx = {
          wallet: {
            create: jest.fn().mockResolvedValue({
              id: 'wallet-new',
              walletAddress: '0xNewWallet',
            }),
          },
          user: {
            create: jest.fn().mockResolvedValue({
              id: 'user-new',
              email: 'new@example.com',
            }),
          },
        };
        return cb(tx);
      });

      const result = await service.register({
        email: 'new@example.com',
        password: 'password123',
      } as any);

      expect(result.id).toBe('user-new');
      expect(result.email).toBe('new@example.com');
    });

    it('should throw ConflictException when email exists', async () => {
      userDBService.getUserByEmail.mockResolvedValue(mockUser);

      await expect(
        service.register({
          email: 'test@example.com',
          password: 'pass',
        } as any),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw InternalServerErrorException on unexpected error', async () => {
      userDBService.getUserByEmail.mockRejectedValue(new Error('DB failed'));

      await expect(
        service.register({ email: 'new@example.com', password: 'pass' } as any),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('refresh', () => {
    it('should return new access token with same refresh token', async () => {
      getSessionByToken.execute.mockResolvedValue({
        id: 'session-1',
        user: mockUser,
      });

      const result = await service.refresh('valid-refresh-token');

      expect(result.accessToken).toBe('jwt-access-token');
      expect(result.refreshToken).toBe('valid-refresh-token');
    });

    it('should throw InternalServerErrorException when no token provided', async () => {
      // The handler wraps UnprocessableEntityException into InternalServerErrorException
      await expect(service.refresh('')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should throw NotFoundException when session not found', async () => {
      getSessionByToken.execute.mockRejectedValue(
        new NotFoundException('Session not found'),
      );

      await expect(service.refresh('invalid-token')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
