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

@Module({
  imports: [PrismaModule],
  controllers: [TempLinkController],
  providers: [
    TempLinkRepository,
    TempLinkDBService,
    CreateTempLink,
    GetTempLinkByUid,
    GetTempLinksByMerchant,
    UpdateTempLink,
    DeleteTempLink,
  ],
  exports: [TempLinkDBService],
})
export class TempLinkModule {}
