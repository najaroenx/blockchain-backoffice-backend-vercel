import { Module } from '@nestjs/common';
import { UserModule } from './modules/user/user.module';
import { PrismaModule } from 'prisma/prisma.module';
import { MerchantModule } from './modules/merchant/merchant.module';
import { PointModule } from './modules/point/point.module';
import { ConfigModule } from '@nestjs/config';
import { configSchema } from './configSchema';
import { ApiKeyModule } from './modules/api-key/api-key.module';
import { TokenModule } from './providers/token/token.module';
import { AuthModule } from './modules/auth/auth.module';
import { SessionModule } from './modules/session/session.module';
import { CustomAuthGuard } from './modules/auth/custom-auth.guard';
import { APP_GUARD } from '@nestjs/core';
import { TransactionModule } from './modules/transaction/transaction.module';
import { CustomerModule } from './modules/customer/customer.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: configSchema,
    }),
    PrismaModule,
    UserModule,
    MerchantModule,
    PointModule,
    ApiKeyModule,
    TokenModule,
    AuthModule,
    SessionModule,
    TransactionModule,
    CustomerModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: CustomAuthGuard,
    },
  ],
})
export class AppModule {}
