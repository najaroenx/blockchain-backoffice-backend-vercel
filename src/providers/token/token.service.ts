import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { nanoid } from 'nanoid';
import { sign, SignOptions, VerifyOptions, verify } from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';
import * as CryptoJS from 'crypto-js';
@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);
  private jwtSecret: string;

  constructor(private configService: ConfigService) {
    this.jwtSecret = this.configService.get<string>('JWT_SECRET');
  }

  /**
   * Generate a cryptographically strong random string
   * @param length - Length of returned string
   */
  async generateRandomString({ length = 20 }): Promise<string> {
    return nanoid(length);
  }

  /**
   * Sign a JWT
   * @param subject - Subject
   * @param payload - Object payload
   * @param expiresIn - Expiry string (vercel/ms)
   * @param options - Signing options
   */
  signJwt(
    subject: string,
    payload: number | string | object | Buffer,
    expiresIn?: string | number,
    options?: SignOptions,
  ) {
    if (typeof payload === 'number') payload = payload.toString();

    const signOptions: SignOptions = {
      ...options,
      subject,
      // force-cast into the library’s StringValue type
      expiresIn: expiresIn as SignOptions['expiresIn'],
    };
    // TODO : add jwt secret
    return sign(payload, this.jwtSecret, signOptions);
  }

  /**
   * Verify and decode a JWT
   * @param subject - Subject
   * @param token - JWT
   * @param options - Verify options
   */
  verify<T>(subject: string, token: string, options?: VerifyOptions) {
    try {
      // TODO : add jwt secret
      return verify(token, this.jwtSecret, { ...options, subject }) as any as T;
    } catch (error) {
      this.logger.error('Error verifying token:', error);
      throw new UnauthorizedException('Invalid token');
    }
  }

  encryptKey = (salt, privateKey) => {
    // Strip surrounding quotes from SALT if present
    const cleanSalt = this.stripQuotes(salt);
    const encryptedPrivateKey = CryptoJS.AES.encrypt(
      privateKey,
      cleanSalt,
    ).toString();
    return encryptedPrivateKey;
  };

  decryptKey = (salt, encryptedData) => {
    // Strip surrounding quotes from SALT if present
    const cleanSalt = this.stripQuotes(salt);
    const bytes = CryptoJS.AES.decrypt(encryptedData, cleanSalt);
    const decryptedMnemonic = bytes.toString(CryptoJS.enc.Utf8);

    return decryptedMnemonic;
  };

  /**
   * Strip surrounding quotes from a string value
   * @param value - String that may have surrounding quotes
   */
  private stripQuotes(value: string): string {
    if (!value) return value;
    const trimmed = value.trim();
    if (
      (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
      return trimmed.slice(1, -1);
    }
    return trimmed;
  }
}
