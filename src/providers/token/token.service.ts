import { Injectable, UnauthorizedException } from '@nestjs/common';
import { nanoid } from 'nanoid';
import { sign, SignOptions, VerifyOptions, verify } from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';
import * as CryptoJS from 'crypto-js';
@Injectable()
export class TokenService {
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
      console.error('Error verifying token:', error);
      throw new UnauthorizedException('Invalid token');
    }
  }

  encryptKey = (salt, privateKey) => {
    const encryptedPrivateKey = CryptoJS.AES.encrypt(
      privateKey,
      salt,
    ).toString();
    return encryptedPrivateKey;
  };

  decryptKey = (salt, encryptedData) => {
    const bytes = CryptoJS.AES.decrypt(encryptedData, salt);
    const decryptedMnemonic = bytes.toString(CryptoJS.enc.Utf8);

    return decryptedMnemonic;
  };
}
