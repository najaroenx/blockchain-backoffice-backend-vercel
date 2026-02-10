import { Injectable } from '@nestjs/common';
import { Session, User } from '@prisma/client';
import { SessionRepository } from '../session.repository';

@Injectable()
export class SessionDBService {
  constructor(private readonly repository: SessionRepository) {}

  async createSession(token: string, userId: string): Promise<Session> {
    const session = await this.repository.create<Session>({
      data: {
        token,
        userId,
      },
    });
    return session;
  }

  async getSessionByToken(token: string): Promise<Session & { user: User }> {
    const session = await this.repository.findFirst<Session & { user: User }>({
      where: { token },
      include: { user: true },
    });

    return session;
  }
}
