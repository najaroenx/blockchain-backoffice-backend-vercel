import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { SessionRepository } from './session.repository';
import { Session } from '@prisma/client';

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
        throw new InternalServerErrorException('server_error');
      }
    }
  }
}
