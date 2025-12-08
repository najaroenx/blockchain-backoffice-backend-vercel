import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { TempLinkDBService } from '../service/templink-db.service';
import { OTPService } from 'src/providers/otp/otp.service';

@Injectable()
export class ReSendOTP {
  private readonly logger = new Logger(ReSendOTP.name);
  private readonly OTP_EXPIRY_MINUTES = 5;

  constructor(
    private readonly tempLinkDBService: TempLinkDBService,
    private readonly otpService: OTPService,
  ) {}

  async execute(uid: string) {
    try {
      this.logger.log(`[ReSendOTP:L22] Resending OTP for uid: ${uid}`);

      // Get temp link by uid
      const tempLink = await this.tempLinkDBService.getTempLinkByUid(uid);

      if (!tempLink) {
        throw new NotFoundException({
          statusCode: 404,
          message: `Temp link with uid ${uid} not found`,
          error: 'TEMP_LINK_NOT_FOUND',
        });
      }

      // Check if expired
      if (tempLink.expire < new Date()) {
        throw new BadRequestException({
          statusCode: 400,
          message: 'URL has expired!',
          error: 'URL_EXPIRED',
        });
      }

      // Check if phone number exists
      if (!tempLink.phoneNumber) {
        throw new BadRequestException({
          statusCode: 400,
          message: 'Phone number not found for this temp link',
          error: 'PHONE_NUMBER_REQUIRED',
        });
      }

      this.logger.log(
        `[ReSendOTP:L55] Generating new OTP for phone: ${tempLink.phoneNumber}`,
      );

      // Generate new OTP
      const newOtp = this.otpService.generateOTP(6);

      // Update temp link with new OTP and extend expiry
      const newExpiry = new Date(
        Date.now() + this.OTP_EXPIRY_MINUTES * 60 * 1000,
      );

      await this.tempLinkDBService.updateTempLink(uid, {
        otp: newOtp,
        expire: newExpiry,
      });

      this.logger.log(`[ReSendOTP:L72] Updated temp link with new OTP`);

      // Send OTP to phone number
      await this.otpService.sendOTP(tempLink.phoneNumber, newOtp);

      this.logger.log(
        `[ReSendOTP:L78] OTP resent successfully to ${tempLink.phoneNumber}`,
      );

      // Delete temp link after successful OTP send
      await this.tempLinkDBService.deleteTempLink(uid);
      this.logger.log(`[ReSendOTP:L83] Temp link deleted for uid: ${uid}`);

      return {
        success: true,
        message: 'OTP resent successfully',
        phoneNumber: tempLink.phoneNumber,
        expiresAt: newExpiry,
      };
    } catch (error) {
      this.logger.error(
        `[ReSendOTP:L89] Error resending OTP: ${error.message}`,
        error.stack,
      );

      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new BadRequestException({
        statusCode: 400,
        message: 'Failed to resend OTP',
        error: 'OTP_RESEND_FAILED',
      });
    }
  }
}
