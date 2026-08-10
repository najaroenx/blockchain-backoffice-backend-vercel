import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AisSmsModule } from 'src/providers/ais-sms/ais-sms.module';
import { OtpService } from './otp.service';

@Module({
  imports: [ConfigModule, AisSmsModule],
  providers: [OtpService],
  exports: [OtpService],
})
export class OtpModule {}
