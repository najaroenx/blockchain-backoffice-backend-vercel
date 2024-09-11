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
import { TokenModule } from './token/token.module';

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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
