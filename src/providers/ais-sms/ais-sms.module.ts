import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AisSmsService } from './ais-sms.service';

@Module({
  imports: [ConfigModule],
  providers: [AisSmsService],
  exports: [AisSmsService],
})
export class AisSmsModule {}
