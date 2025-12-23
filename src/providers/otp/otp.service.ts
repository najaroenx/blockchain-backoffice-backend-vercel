import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';

@Injectable()
export class OTPService {
  private logger = new Logger(OTPService.name);
  private otpApiUrl: string;
  private otpApiUsername: string;
  private otpApiPassword: string;

  constructor(private configService: ConfigService) {
    this.otpApiUrl = this.configService.get<string>('OTP_API_URL');
    this.otpApiUsername = this.configService.get<string>('OTP_API_USERNAME');
    this.otpApiPassword = this.configService.get<string>('OTP_API_PASSWORD');
  }

  /**
   * Send OTP to phone number
   * @param phoneNumber - Phone number to send OTP
   * @param otp - OTP code to send
   * @returns Success response
   */
  async sendOTP(
    phoneNumber: string,
    otp: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      this.logger.log(`Sending OTP to phone: ${phoneNumber}`, `${otp}`);

      // Create Base64 encoded credentials for Basic Auth
      const credentials = Buffer.from(
        `${this.otpApiUsername}:${this.otpApiPassword}`,
      ).toString('base64');
      const bodyReq = {
        sender: 'saleday',
        text: `รหัส OTP คือ ${otp} จะหมดอายุใน 5 นาที และจะใช้ได้ 1 ครั้งเท่านั้น`,
        destinations: [
          {
            destination: phoneNumber,
          },
        ],
        callback_url: 'https://dlp-backofficefe-testnet.adldigitalservice.com',
        callback_method: 'GET',
      };
      const response = await fetch(this.otpApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${credentials}`,
        },
        body: JSON.stringify(bodyReq),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        this.logger.error(
          `Failed to send OTP: ${response.statusText}`,
          errorData,
        );
        this.logger.error(errorData);
        throw new Error(`Failed to send OTP: ${response.statusText}`);
      }

      //   const data = await response.json();
      this.logger.log(`OTP sent successfully to ${phoneNumber}`);

      return {
        success: true,
        message: 'OTP sent successfully',
      };
    } catch (error) {
      this.logger.error(`Error sending OTP: ${error.message}`, error.stack);
      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Generate random OTP code
   * @param length - Length of OTP (default: 6)
   * @returns OTP string
   */
  generateOTP(length: number = 6): string {
    const digits = '0123456789';
    let otp = '';
    for (let i = 0; i < length; i++) {
      otp += digits[Math.floor(Math.random() * 10)];
    }
    return otp;
  }
}
