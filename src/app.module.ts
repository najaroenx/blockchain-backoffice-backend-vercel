import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './user/user.module';
import { PrismaModule } from 'prisma/prisma.module';
import { MerchantModule } from './merchant/merchant.module';
import { PointModule } from './point/point.module';

@Module({
  imports: [PrismaModule, UserModule, MerchantModule, PointModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
