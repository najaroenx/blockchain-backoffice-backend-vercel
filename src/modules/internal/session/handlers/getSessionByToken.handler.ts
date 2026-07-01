import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  INTERNAL_SERVER_ERROR,
  SESSION_NOT_FOUND,
} from 'src/errors/error.constants';
import { Session, User } from '@prisma/client';
import { SessionDBService } from '../services/session-db.service';

@Injectable()
export class GetSessionByToken {
  constructor(private readonly db: SessionDBService) {}

  async execute(token: string): Promise<Session & { user: User }> {
    try {
      const session = await this.db.getSessionByToken(token);

      if (!session) throw new NotFoundException(SESSION_NOT_FOUND);

      return session;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      } else {
        throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
      }
    }
  }
}
