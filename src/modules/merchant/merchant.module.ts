import { Module } from '@nestjs/common';
import { MerchantController } from './merchant.controller';
import { MerchantService } from './merchant.service';
import { MerchantRepository } from './merchant.repository';
import { ApiKeyModule } from '../api-key/api-key.module';

@Module({
  controllers: [MerchantController],
  providers: [MerchantService, MerchantRepository],
  imports: [ApiKeyModule],
})
export class MerchantModule {}
