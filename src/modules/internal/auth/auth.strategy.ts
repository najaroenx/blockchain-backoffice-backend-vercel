import { Injectable, Logger } from '@nestjs/common';
import { TokenService } from 'src/providers/token/token.service';
import { Request } from 'express';
import { LOGIN_ACCESS_TOKEN } from 'src/providers/token/token.constants';
import { AccessTokenClaims } from './types/AccessTokenClaims';
import { Strategy } from 'passport-strategy';
import { PassportStrategy } from '@nestjs/passport';
import { GetApiKey } from '../api-key/handlers/getApiKey.handler';

class AuthStrategyName extends Strategy {
  name = 'authStrategy';
}

@Injectable()
export class AuthStrategy extends PassportStrategy(AuthStrategyName) {
  private readonly logger = new Logger(AuthStrategy.name);

  constructor(
    private readonly tokenService: TokenService,
    private readonly getApiKey: GetApiKey,
  ) {
    super();
  }

  authenticate(request: Request): void {
    void this.authenticateAsync(request);
  }

  private async authenticateAsync(request: Request): Promise<void> {
    /** API key authorization */
    const authorizationKey = this.extractAuthorizationKey(request);

    if (
      authorizationKey &&
      // If authentication is *not* a JWT
      !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+={0,2})?$/.test(
        authorizationKey,
      )
    ) {
      try {
        const merchantId = request.params['merchantId'];

        const apiKeyDetails = await this.getApiKey.execute(
          authorizationKey,
          merchantId,
        );

        this.success({
          type: 'api-key',
          id: apiKeyDetails.id,
        });
        return;
      } catch (error) {
        this.logger.debug(`API key auth failed for key: ${error?.message}`);
      }
    }

    let bearerToken = request.query['token'] ?? request.headers.authorization;

    if (typeof bearerToken !== 'string') {
      this.fail('Invalid request', 400);
      return;
    }

    if (bearerToken.startsWith('Bearer '))
      bearerToken = bearerToken.replace('Bearer ', '');

    try {
      const payload = this.tokenService.verify(
        LOGIN_ACCESS_TOKEN,
        bearerToken,
      ) as AccessTokenClaims;
      this.success(payload);
    } catch (err: any) {
      this.logger.warn(`Invalid token: ${err.message}`);
      this.fail('Invalid token', 400);
    }
  }

  /**
   * Extracts and normalizes the authorization key from the request,
   * checking query params, headers, and stripping "Bearer " prefix.
   */
  private extractAuthorizationKey(request: Request): string {
    let key = '';

    if (typeof request.query.api_key === 'string') key = request.query.api_key;
    else if (typeof request.headers['x-api-key'] === 'string')
      key = request.headers['x-api-key'];
    else if (request.headers.authorization)
      key = request.headers.authorization as string;

    // Strip "Bearer " prefix (handles double-prefix edge case)
    key = key.replace('Bearer ', '');
    if (key.startsWith('Bearer ')) {
      key = key.replace('Bearer ', '');
    }

    return key;
  }

  // PassportStrategy requires validate even when authenticate is overridden
  async validate(): Promise<void> {}
}
