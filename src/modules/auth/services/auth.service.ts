import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { User } from '@prisma/client';
import { TokenService } from 'src/providers/token/token.service';
import { UserRepository } from 'src/modules/user/user.repository';
import { AccessTokenClaims } from '../types/AccessTokenClaims';
import { LOGIN_ACCESS_TOKEN } from 'src/providers/token/token.constants';
import { TokenResponse } from '../interfaces/TokenResponse';
import {
  INTERNAL_SERVER_ERROR,
  NO_TOKEN_PROVIDED,
  USER_NOT_FOUND,
} from 'src/errors/error.constants';
import { CreateSession } from 'src/modules/session/handlers/createSession.handler';
import { GetSessionByToken } from 'src/modules/session/handlers/getSessionByToken.handler';

@Injectable()
export class AuthService {
  constructor(
    private repository: UserRepository,
    private tokenService: TokenService,
    private createSession: CreateSession,
    private getSessionByToken: GetSessionByToken,
  ) {}

  async login(email: string, password: string): Promise<TokenResponse> {
    try {
      const user = await this.repository.getUserByEmail(email, password);

      if (!user) throw new NotFoundException(USER_NOT_FOUND);

      return this.loginResponse(user);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      } else {
        throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
      }
    }
  }

  async refresh(token: string): Promise<TokenResponse> {
    try {
      if (!token) throw new UnprocessableEntityException(NO_TOKEN_PROVIDED);
      const session = await this.getSessionByToken.execute(token);

      return {
        accessToken: await this.getAccessToken(session.user, session.id),
        refreshToken: token,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      } else {
        throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
      }
    }
  }

  private async loginResponse(user: User): Promise<TokenResponse> {
    const token = await this.tokenService.generateRandomString({ length: 30 });
    const { id } = await this.createSession.execute(token, user.id);

    const accessToken = await this.getAccessToken(user, id);

    return {
      accessToken,
      refreshToken: token,
    };
  }

  private async getAccessToken(user: User, sessionId: string): Promise<string> {
    const payload: AccessTokenClaims = {
      id: user.id,
      email: user.email,
      sessionId,
    };

    const expiresIn = 30 * 24 * 60 * 60 * 1000; // 1 month in milliseconds

    return this.tokenService.signJwt(
      LOGIN_ACCESS_TOKEN,
      payload,
      expiresIn.toString(),
    );
  }
}
