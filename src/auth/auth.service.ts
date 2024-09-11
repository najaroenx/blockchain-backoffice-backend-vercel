import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { User } from '@prisma/client';
import { SessionService } from 'src/session/session.service';
import { TokenService } from 'src/token/token.service';
import { UserRepository } from 'src/user/user.repository';
import { AccessTokenClaims } from './interfaces';
import { LOGIN_ACCESS_TOKEN } from 'src/token/token.constants';
import { TokenResponse } from './interfaces/TokenResponse';

@Injectable()
export class AuthService {
  constructor(
    private repository: UserRepository,
    private tokenService: TokenService,
    private sessionService: SessionService,
  ) {}

  async login(email: string, password: string) {
    try {
      const user = await this.repository.getUserByEmail(email, password);

      if (!user) throw new NotFoundException('data_not_found');

      return this.loginResponse(user);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      } else {
        throw new InternalServerErrorException('server_error');
      }
    }
  }

  private async loginResponse(user: User): Promise<TokenResponse> {
    const token = await this.tokenService.generateRandomString({ length: 30 });
    const { id } = await this.sessionService.createSession(token, user.id);

    const accessToken = await this.getAccessToken(user, id);

    return {
      userId: user.id,
      accessToken,
      refreshToken: token,
    };
  }

  private async getAccessToken(user: User, sessionId: string): Promise<string> {
    const payload: AccessTokenClaims = {
      id: user.id,
      sessionId,
    };
    return this.tokenService.signJwt(LOGIN_ACCESS_TOKEN, payload, '10000000');
  }
}
