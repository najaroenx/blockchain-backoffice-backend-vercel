import { Module } from '@nestjs/common';
import { AisSmsModule as AisSmsProviderModule } from 'src/providers/ais-sms/ais-sms.module';
import { AisSmsController } from './controllers/ais-sms.controller';
import { SendAisSmsTest } from './handlers/sendAisSmsTest.handler';

@Module({
  imports: [AisSmsProviderModule],
  controllers: [AisSmsController],
  providers: [SendAisSmsTest],
})
export class AisSmsModule {}
