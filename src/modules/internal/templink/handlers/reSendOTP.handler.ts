import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { TempLinkDBService } from '../service/templink-db.service';
import { OtpService } from 'src/modules/internal/otp/otp.service';

@Injectable()
export class ReSendOTP {
  private readonly logger = new Logger(ReSendOTP.name);
  private readonly OTP_EXPIRY_MINUTES = 5;

  constructor(
    private readonly tempLinkDBService: TempLinkDBService,
    private readonly otpService: OtpService,
  ) {}

  async execute(uid: string) {
    try {
      this.logger.log(`Resending OTP for uid: ${uid}`);

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

      const newOtp = this.otpService.generateOtp(6);
      const hashedOtp = this.otpService.hashOtp(newOtp);
      const newExpiry = new Date(
        Date.now() + this.OTP_EXPIRY_MINUTES * 60 * 1000,
      );

      await this.tempLinkDBService.updateTempLink(uid, {
        otp: hashedOtp,
        expire: newExpiry,
      });
      const phoneFormatted = tempLink.phoneNumber.startsWith('0')
        ? `66${tempLink.phoneNumber.slice(1)}`
        : tempLink.phoneNumber;
      await this.otpService.sendOtpViaAisSms(phoneFormatted, newOtp);

      return {
        success: true,
        message: 'OTP resent successfully',
        phoneNumber: tempLink.phoneNumber,
        expiresAt: newExpiry,
        otp: newOtp, // For testing purposes, return the OTP in the response
      };
    } catch (error) {
      this.logger.error(`Error resending OTP: ${error.message}`, error.stack);

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
