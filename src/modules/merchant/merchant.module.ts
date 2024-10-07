import { Module } from '@nestjs/common';
import { MerchantController } from './controllers/merchant.controller';
import { MerchantRepository } from './merchant.repository';
import { ApiKeyModule } from '../api-key/api-key.module';
import { MerchantDBService } from './services/merchant-db.service';
import { GetMerchants } from './handlers/getMerchants.handler';
import { CreateMerchant } from './handlers/createMerchant.handler';

@Module({
  controllers: [MerchantController],
  providers: [
    MerchantRepository,
    MerchantDBService,
    GetMerchants,
    CreateMerchant,
  ],
  imports: [ApiKeyModule],
})
export class MerchantModule {}
