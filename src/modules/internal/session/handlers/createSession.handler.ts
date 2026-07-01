import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';
import { Session } from '@prisma/client';
import { SessionDBService } from '../services/session-db.service';

@Injectable()
export class CreateSession {
  constructor(private readonly db: SessionDBService) {}

  async execute(token: string, userId: string): Promise<Session> {
    try {
      const session = await this.db.createSession(token, userId);

      return session;
    } catch (error) {
      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }
}
