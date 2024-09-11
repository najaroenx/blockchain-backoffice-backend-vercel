import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './user/user.module';
import { PrismaModule } from 'prisma/prisma.module';
import { MerchantModule } from './merchant/merchant.module';
import { PointModule } from './point/point.module';
import { ConfigModule } from '@nestjs/config';
import { configSchema } from './configSchema';
import { ApiKeyModule } from './api-key/api-key.module';
import { TokenModule } from './providers/token/token.module';
import { AuthModule } from './auth/auth.module';
import { SessionModule } from './session/session.module';
import { CustomAuthGuard } from './auth/custom-auth.guard';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    PrismaModule,
    UserModule,
    MerchantModule,
    PointModule,
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: configSchema,
    }),
    ApiKeyModule,
    TokenModule,
    AuthModule,
    SessionModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: CustomAuthGuard,
    },
  ],
})
export class AppModule {}
