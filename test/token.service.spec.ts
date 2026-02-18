jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import { UnauthorizedException } from '@nestjs/common';
import { TokenService } from 'src/providers/token/token.service';
import { ConfigService } from '@nestjs/config';

describe('TokenService', () => {
  let service: TokenService;

  beforeEach(() => {
    const mockConfigService = {
      get: jest.fn().mockReturnValue('test-jwt-secret'),
    };
    service = new TokenService(mockConfigService as unknown as ConfigService);
  });

  describe('generateRandomString', () => {
    it('should generate a string of given length', async () => {
      const result = await service.generateRandomString({ length: 30 });
      expect(typeof result).toBe('string');
      expect(result.length).toBe(30);
    });

    it('should default to length 20', async () => {
      const result = await service.generateRandomString({});
      expect(result.length).toBe(20);
    });
  });

  describe('signJwt and verify', () => {
    it('should sign and verify a JWT token', () => {
      const token = service.signJwt('test-sub', { userId: 'u1' }, '1h');
      expect(typeof token).toBe('string');

      const decoded = service.verify<{ userId: string }>('test-sub', token);
      expect(decoded.userId).toBe('u1');
    });

    it('should sign with different expiry values', () => {
      const token = service.signJwt('test-sub', { data: 'test' }, '30m');
      expect(typeof token).toBe('string');
      const decoded = service.verify('test-sub', token);
      expect(decoded).toMatchObject({ data: 'test' });
    });

    it('should throw UnauthorizedException for invalid token', () => {
      expect(() => service.verify('test-sub', 'invalid-token')).toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for wrong subject', () => {
      const token = service.signJwt('subject-a', { data: 1 }, '1h');
      expect(() => service.verify('subject-b', token)).toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('encryptKey and decryptKey', () => {
    it('should encrypt and decrypt a key successfully', () => {
      const salt = 'my-salt';
      const privateKey = 'my-private-key-12345';

      const encrypted = service.encryptKey(salt, privateKey);
      expect(typeof encrypted).toBe('string');
      expect(encrypted).not.toBe(privateKey);

      const decrypted = service.decryptKey(salt, encrypted);
      expect(decrypted).toBe(privateKey);
    });

    it('should handle salt with surrounding quotes', () => {
      const salt = '"my-quoted-salt"';
      const key = 'test-key';

      const encrypted = service.encryptKey(salt, key);
      const decrypted = service.decryptKey(salt, encrypted);
      expect(decrypted).toBe(key);
    });

    it('should handle salt with single quotes', () => {
      const salt = "'single-quoted'";
      const key = 'test-key';

      const encrypted = service.encryptKey(salt, key);
      const decrypted = service.decryptKey(salt, encrypted);
      expect(decrypted).toBe(key);
    });
  });
});
