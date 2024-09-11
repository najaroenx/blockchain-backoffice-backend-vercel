import { Module } from '@nestjs/common';
import { SessionService } from './session.service';
import { SessionController } from './session.controller';
import { SessionRepository } from './session.repository';

@Module({
  providers: [SessionService, SessionRepository],
  controllers: [SessionController],
  exports: [SessionService],
})
export class SessionModule {}
