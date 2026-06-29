import { Module } from '@nestjs/common';
import { TempLinkRepository } from './templink.repository';
import { TempLinkDBService } from './service/templink-db.service';
import { PrismaModule } from 'prisma/prisma.module';
import { TempLinkController } from './controllers/templink.controller';
import {
  CreateTempLink,
  GetTempLinkByUid,
  GetTempLinksByMerchant,
  UpdateTempLink,
  DeleteTempLink,
} from './handlers';
import { CreateOTP } from './handlers/createOTP.handler';
import { VerifyOTP } from './handlers/verifyOTP.handler';
import { ReSendOTP } from './handlers/reSendOTP.handler';
import { OtpModule } from '../otp/otp.module';

@Module({
  imports: [PrismaModule, OtpModule],
  controllers: [TempLinkController],
  providers: [
    TempLinkRepository,
    TempLinkDBService,
    CreateTempLink,
    GetTempLinkByUid,
    GetTempLinksByMerchant,
    UpdateTempLink,
    DeleteTempLink,
    CreateOTP,
    VerifyOTP,
    ReSendOTP,
  ],
  exports: [TempLinkDBService],
})
export class TempLinkModule {}
