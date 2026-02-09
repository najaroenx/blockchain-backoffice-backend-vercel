import { Module } from '@nestjs/common';
import { AuthService } from './services/auth.service';
import { AuthController } from './controllers/auth.controller';
import { UserRepository } from 'src/modules/internal/user/user.repository';
import { TokenModule } from 'src/providers/token/token.module';
import { SessionModule } from 'src/modules/internal/session/session.module';
import { AuthStrategy } from './auth.strategy';
import { PassportModule } from '@nestjs/passport';
import { ApiKeyModule } from '../api-key/api-key.module';
import { UserModule } from '../user/user.module';
import { PrismaModule } from 'prisma/prisma.module';

@Module({
  imports: [
    TokenModule,
    SessionModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    ApiKeyModule,
    UserModule,
    PrismaModule,
  ],
  providers: [AuthService, UserRepository, AuthStrategy],
  controllers: [AuthController],
})
export class AuthModule {}
