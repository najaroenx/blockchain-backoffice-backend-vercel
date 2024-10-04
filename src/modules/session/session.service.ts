import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { SessionRepository } from './session.repository';
import { Session, User } from '@prisma/client';
import {
  INTERNAL_SERVER_ERROR,
  SESSION_NOT_FOUND,
} from 'src/errors/error.constants';

@Injectable()
export class SessionService {
  constructor(private repository: SessionRepository) {}

  async createSession(token: string, userId: string): Promise<Session> {
    try {
      return await this.repository.create({
        data: {
          token,
          userId,
        },
      });
    } catch (error) {
      console.log(error);
      if (error instanceof NotFoundException) {
        throw error;
      } else {
        throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
      }
    }
  }

  async getSessionByToken(token: string): Promise<Session & { user: User }> {
    try {
      const session = await this.repository.findFirst<Session & { user: User }>(
        {
          where: { token },
          include: { user: true },
        },
      );

      if (!session) throw new NotFoundException(SESSION_NOT_FOUND);

      return session;
    } catch (error) {
      console.log(error);
      if (error instanceof NotFoundException) {
        throw error;
      } else {
        throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
      }
    }
  }
}
