import { Module } from '@nestjs/common';
import { OTPService } from './otp.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [OTPService],
  exports: [OTPService],
})
export class OTPModule {}
