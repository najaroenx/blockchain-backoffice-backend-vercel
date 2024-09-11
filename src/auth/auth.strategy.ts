import { Injectable } from '@nestjs/common';
import { TokenService } from 'src/providers/token/token.service';
import { Request } from 'express';
import { LOGIN_ACCESS_TOKEN } from 'src/providers/token/token.constants';
import { AccessTokenClaims } from './interfaces';
import { Strategy } from 'passport-strategy';
import { PassportStrategy } from '@nestjs/passport';

class AuthStrategyName extends Strategy {
  name = 'authStrategy';
}

@Injectable()
export class AuthStrategy extends PassportStrategy(AuthStrategyName) {
  constructor(private tokenService: TokenService) {
    super();
  }

  authenticate(request: Request) {
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
    } catch (error) {}

    return this.fail('Invalid token', 400);
  }
}
