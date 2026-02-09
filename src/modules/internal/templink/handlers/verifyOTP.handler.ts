import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { TempLinkDBService } from '../service/templink-db.service';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';

@Injectable()
export class VerifyOTP {
  private logger = new Logger(VerifyOTP.name);

  constructor(private tempLinkDBService: TempLinkDBService) {}

  async execute(phoneNumber: string, otpCode: string) {
    try {
      // Get temp link by phone number
      const tempLink =
        await this.tempLinkDBService.getTempLinkByPhoneNumber(phoneNumber);

      if (!tempLink) {
        throw new NotFoundException(
          `Temp link with phone number ${phoneNumber} not found`,
        );
      }

      // Check if expired
      if (tempLink.expire < new Date()) {
        throw new BadRequestException('Temp link has expired');
      }

      // Check if OTP exists
      if (!tempLink.otp) {
        throw new BadRequestException('No OTP found for this phone number');
      }

      // Verify OTP
      if (tempLink.otp !== otpCode) {
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
