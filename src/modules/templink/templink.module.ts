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
import { OTPModule } from 'src/providers/otp/otp.module';

@Module({
  imports: [PrismaModule, OTPModule],
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
  ],
  exports: [TempLinkDBService],
})
export class TempLinkModule {}
