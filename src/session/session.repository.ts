import { Injectable } from '@nestjs/common';
import { Session } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';
import { PrismaRepository } from 'src/repository';

@Injectable()
export class SessionRepository extends PrismaRepository<'session'> {
  constructor() {
    super(new PrismaService(), 'session');
  }

  async createSession(token: string, userId: string): Promise<Session> {
    const session = await this.create({
      data: {
        token,
        User: {
          connect: {
            id: userId,
          },
        },
      },
    });

    return session;
  }
}
