import { Module } from '@nestjs/common';
import { AisSmsModule as AisSmsProviderModule } from 'src/providers/ais-sms/ais-sms.module';
import { AisSmsController } from './controllers/ais-sms.controller';
import { SendAisSmsTest } from './handlers/sendAisSmsTest.handler';
import { TelnetCheck } from './handlers/telnetCheck.handler';

@Module({
  imports: [AisSmsProviderModule],
  controllers: [AisSmsController],
  providers: [SendAisSmsTest, TelnetCheck],
})
export class AisSmsModule {}
