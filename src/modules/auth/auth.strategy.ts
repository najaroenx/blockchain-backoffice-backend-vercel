import { Injectable } from '@nestjs/common';
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
  constructor(
    private tokenService: TokenService,
    private getApiKey: GetApiKey,
  ) {
    super();
  }

  async authenticate(request: Request) {
    /** API key authorization */
    let authorizationKey = '';

    if (typeof request.query.api_key === 'string')
      authorizationKey = request.query.api_key.replace('Bearer ', '');
    else if (typeof request.headers['x-api-key'] === 'string')
      authorizationKey = request.headers['x-api-key'].replace('Bearer ', '');
    else if (request.headers.authorization)
      authorizationKey = request.headers.authorization.replace('Bearer ', '');

    if (typeof authorizationKey === 'string') {
      if (authorizationKey.startsWith('Bearer '))
        authorizationKey = authorizationKey.replace('Bearer ', '');

      if (
        // If authentication is *not* a JWT
        !authorizationKey.match(
          /^[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*$/,
        )
      ) {
        try {
          const merchantId = request.params['merchantId'];

          const apiKeyDetails = await this.getApiKey.execute(
            authorizationKey,
            merchantId,
          );

          return this.success({
            type: 'api-key',
            id: apiKeyDetails.id,
          });
        } catch {}
      }
    }

    let bearerToken = request.query['token'] ?? request.headers.authorization;

    if (typeof bearerToken !== 'string') {
      return this.fail('Invalid request', 400);
    }

    if (bearerToken.startsWith('Bearer '))
      bearerToken = bearerToken.replace('Bearer ', '');

    try {
      const payload = this.tokenService.verify(
        LOGIN_ACCESS_TOKEN,
        bearerToken,
      ) as AccessTokenClaims;
      return this.success(payload);
    } catch (err: any) {
      console.error('Invalid token', err.toString());
      return this.fail('Invalid token', 400);
    }
  }

  // PassportStrategy requires validate even when authenticate is overridden
  async validate(): Promise<void> {}
}
