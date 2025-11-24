import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { TempLinkDBService } from '../service/templink-db.service';
import { OTPService } from 'src/providers/otp/otp.service';
import { INTERNAL_SERVER_ERROR } from 'src/errors/error.constants';

@Injectable()
export class CreateOTP {
  private logger = new Logger(CreateOTP.name);

  constructor(
    private tempLinkDBService: TempLinkDBService,
    private otpService: OTPService,
  ) {}

  async execute(uid?: string) {
    try {
      //   Get temp link by uid
      const tempLink = await this.tempLinkDBService.getTempLinkByUid(uid);

      if (!tempLink) {
        throw new Error(`Temp link with uid ${uid} not found`);
      }

      // Check if expired
      if (tempLink.expire < new Date()) {
        throw new Error(`Temp link has expired`);
      }
      console.log(uid);

      // Send OTP to phone number
      await this.otpService.sendOTP(tempLink.phoneNumber, tempLink.otp);

      return {
        success: true,
        message: 'OTP sent successfully',
        phoneNumber: tempLink.phoneNumber,
      };
    } catch (error) {
      this.logger.error(`Error creating OTP: ${error.message}`, error.stack);
      throw new InternalServerErrorException(INTERNAL_SERVER_ERROR);
    }
  }
}
