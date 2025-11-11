import { Module } from '@nestjs/common';
import { MerchantController } from './controllers/merchant.controller';
import { MerchantRepository } from './merchant.repository';
import { ApiKeyModule } from '../api-key/api-key.module';
import { MerchantDBService } from './services/merchant-db.service';
import { GetMerchants } from './handlers/getMerchants.handler';
import { CreateMerchant } from './handlers/createMerchant.handler';
import { UpdateMerchant } from './handlers/updateMerchant.handler';
import { GetMerchant } from './handlers/getMerchantById.handler';
import { DeleteMerchant } from './handlers/deleteMerchant.handler';
import { PrismaModule } from 'prisma/prisma.module';

@Module({
  controllers: [MerchantController],
  providers: [
    MerchantRepository,
    MerchantDBService,
    GetMerchants,
    CreateMerchant,
    UpdateMerchant,
    GetMerchant,
    DeleteMerchant,
  ],
  imports: [ApiKeyModule, PrismaModule],
})
export class MerchantModule {}
