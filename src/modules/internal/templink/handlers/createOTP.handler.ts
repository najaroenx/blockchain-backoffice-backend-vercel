import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { TempLinkDBService } from '../service/templink-db.service';
import { OtpService } from 'src/modules/internal/otp/otp.service';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';

@Injectable()
export class CreateOTP {
  private readonly logger = new Logger(CreateOTP.name);

  constructor(
    private readonly tempLinkDBService: TempLinkDBService,
    private readonly otpService: OtpService,
  ) {}

  async execute(uid?: string, phoneNumber?: string) {
    try {
      const tempLink = await this.tempLinkDBService.getTempLinkByUid(uid);
      if (!tempLink) {
        throw new Error(`Temp link with uid ${uid} not found`);
      }
      if (tempLink.expire < new Date()) {
        throw new Error(`URL has expired!`);
      }
      this.logger.log(`Creating OTP for temp link with uid: ${uid}`);

      const otp = this.otpService.generateOtp(6);
      const hashedOtp = this.otpService.hashOtp(otp);

      await this.tempLinkDBService.updateTempLink(uid, {
        phoneNumber,
        otp: hashedOtp,
      });
      await this.otpService.sendOtp(phoneNumber, otp);

      return {
        success: true,
        message: 'OTP sent successfully',
        phoneNumber: tempLink.phoneNumber,
        otp: otp, // For testing purposes, return the OTP in the response
      };
    } catch (error) {
      this.logger.error(`Error creating OTP: ${error.message}`, error.stack);
      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }
}
