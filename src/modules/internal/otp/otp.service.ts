import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomInt, createHash, timingSafeEqual } from 'crypto';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private readonly otpApiUrl: string;
  private readonly otpApiUsername: string;
  private readonly otpApiPassword: string;

  constructor(private readonly configService: ConfigService) {
    this.otpApiUrl = this.configService.get<string>('OTP_API_URL');
    this.otpApiUsername = this.configService.get<string>('OTP_API_USERNAME');
    this.otpApiPassword = this.configService.get<string>('OTP_API_PASSWORD');
  }

  generateOtp(length: number = 6): string {
    let otp = '';
    for (let i = 0; i < length; i++) {
      otp += randomInt(10).toString();
    }
    return otp;
  }

  hashOtp(otp: string): string {
    return createHash('sha256').update(otp).digest('hex');
  }

  compareOtp(storedHash: string, provided: string): boolean {
    const hashedProvided = this.hashOtp(provided);
    if (storedHash.length !== hashedProvided.length) return false;
    return timingSafeEqual(
      Buffer.from(storedHash),
      Buffer.from(hashedProvided),
    );
  }

  async sendOtp(
    phoneNumber: string,
    otp: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const maskedPhone = phoneNumber.replace(/(\d{3})\d+(\d{2})/, '$1***$2');
      this.logger.log(`Sending OTP to phone: ${maskedPhone}`);

      const credentials = Buffer.from(
        `${this.otpApiUsername}:${this.otpApiPassword}`,
      ).toString('base64');

      const response = await fetch(this.otpApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${credentials}`,
        },
        body: JSON.stringify({
          sender: 'myAvatar',
          text: `รหัส OTP คือ ${otp} จะหมดอายุใน 5 นาที และจะใช้ได้ 1 ครั้งเท่านั้น`,
          destinations: [{ destination: phoneNumber }],
          callback_url:
            'https://dlp-backofficefe-testnet.adldigitalservice.com',
          callback_method: 'GET',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        this.logger.error(
          `Failed to send OTP: ${response.statusText}`,
          errorData,
        );
        throw new Error(`Failed to send OTP: ${response.statusText}`);
      }

      const data = await response.json().catch(() => ({}));
      if (data.success === false) {
        this.logger.error(`SMS API returned failure: ${JSON.stringify(data)}`);
        throw new Error(
          `SMS API returned failure: ${data.message || 'unknown'}`,
        );
      }

      this.logger.log(`OTP sent successfully to ${maskedPhone}`);
      return { success: true, message: 'OTP sent successfully' };
    } catch (error) {
      this.logger.error(`Error sending OTP: ${error.message}`, error.stack);
      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }
}
