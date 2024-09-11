import { Injectable, UnauthorizedException } from '@nestjs/common';
import { nanoid } from 'nanoid';
import { sign, SignOptions, VerifyOptions, verify } from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';

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
    expiresIn?: string,
    options?: SignOptions,
  ) {
    if (typeof payload === 'number') payload = payload.toString();
    // TODO : add jwt secret
    return sign(payload, this.jwtSecret, {
      ...options,
      subject,
      expiresIn,
    });
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
      throw new UnauthorizedException('Invalid token');
    }
  }
}
