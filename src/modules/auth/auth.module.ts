import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UserRepository } from 'src/modules/user/user.repository';
import { TokenModule } from 'src/providers/token/token.module';
import { SessionModule } from 'src/modules/session/session.module';
import { AuthStrategy } from './auth.strategy';
import { PassportModule } from '@nestjs/passport';
import { ApiKeyModule } from '../api-key/api-key.module';

@Module({
  imports: [
    TokenModule,
    SessionModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    ApiKeyModule,
  ],
  providers: [AuthService, UserRepository, AuthStrategy],
  controllers: [AuthController],
})
export class AuthModule {}
