import { Module } from '@nestjs/common';
import { SessionController } from './controllers/session.controller';
import { SessionRepository } from './session.repository';
import { SessionDBService } from './services/session-db.service';
import { CreateSession } from './handlers/createSession.handler';
import { GetSessionByToken } from './handlers/getSessionByToken.handler';

@Module({
  providers: [
    SessionRepository,
    SessionDBService,
    CreateSession,
    GetSessionByToken,
  ],
  controllers: [SessionController],
  exports: [CreateSession, GetSessionByToken],
})
export class SessionModule {}
