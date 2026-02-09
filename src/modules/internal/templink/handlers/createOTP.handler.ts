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

  async execute(uid?: string, phoneNumber?: string) {
    try {
      //   Get temp link by uid
      const tempLink = await this.tempLinkDBService.getTempLinkByUid(uid);
      this.logger.log(
        `Executing CreateOTP handler for uid: ${JSON.stringify(tempLink)}`,
      );
      if (!tempLink) {
        throw new Error(`Temp link with uid ${uid} not found`);
      }
      // Check if expired
      if (tempLink.expire < new Date()) {
        throw new Error(`URL has expired!`);
      }
      this.logger.log(`Creating OTP for temp link with uid: ${uid}`);
      tempLink.phoneNumber = phoneNumber;
      await this.tempLinkDBService.updateTempLink(uid, tempLink);
      // Send OTP to phone number
      await this.otpService.sendOTP(phoneNumber, tempLink.otp);

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
