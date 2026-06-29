import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { TempLinkDBService } from '../service/templink-db.service';
import { OtpService } from 'src/modules/internal/otp/otp.service';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';

@Injectable()
export class VerifyOTP {
  private readonly logger = new Logger(VerifyOTP.name);

  constructor(
    private readonly tempLinkDBService: TempLinkDBService,
    private readonly otpService: OtpService,
  ) {}

  async execute(phoneNumber: string, otpCode: string) {
    try {
      const tempLink =
        await this.tempLinkDBService.getTempLinkByPhoneNumber(phoneNumber);

      if (!tempLink) {
        throw new NotFoundException(
          `Temp link with phone number ${phoneNumber} not found`,
        );
      }

      if (tempLink.expire < new Date()) {
        throw new BadRequestException('Temp link has expired');
      }

      if (!tempLink.otp) {
        throw new BadRequestException('No OTP found for this phone number');
      }

      if (!this.otpService.compareOtp(tempLink.otp, otpCode)) {
        throw new BadRequestException('Invalid OTP code');
      }

      this.logger.log(`OTP verified successfully for phone: ${phoneNumber}`);

      // Delete temp link after successful verification
      await this.tempLinkDBService.deleteTempLink(tempLink.uid);
      this.logger.log(`Temp link deleted for uid: ${tempLink.uid}`);

      return {
        id: tempLink.id,
        uid: tempLink.uid,
        phoneNumber: tempLink.phoneNumber,
        merchantId: tempLink.merchantId,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      this.logger.error(`Error verifying OTP: ${error.message}`, error.stack);
      throw new BadRequestException(INTERNAL_SERVER_ERROR);
    }
  }
}
