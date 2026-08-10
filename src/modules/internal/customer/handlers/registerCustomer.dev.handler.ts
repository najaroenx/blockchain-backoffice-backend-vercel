import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CustomerDBService } from '../services/customer-db.service';
import { ConfigService } from '@nestjs/config';
import { OtpService } from 'src/modules/internal/otp/otp.service';
import { TempLinkDBService } from 'src/modules/internal/templink/service/templink-db.service';
import { randomUUID } from 'node:crypto';
import { MerchantDBService } from 'src/modules/internal/merchant/services/merchant-db.service';

export interface RegistrationResponse {
  url: string;
  callbackUrl: string;
  merchantId: string;
}

@Injectable()
export class RegisterCustomerDev {
  private readonly logger = new Logger(RegisterCustomerDev.name);
  private readonly OTP_EXPIRY_MINUTES = 5;

  constructor(
    private readonly db: CustomerDBService,
    private readonly configService: ConfigService,
    private readonly otpService: OtpService,
    private readonly tempLinkDBService: TempLinkDBService,
    private readonly merchantDBService: MerchantDBService,
  ) {}

  async execute(merchantId: string, callbackUri?: string): Promise<any> {
    try {
      const merchant = await this.merchantDBService.getMerchantById(merchantId);
      this.logger.log(merchant);

      if (!merchant) {
        throw new BadRequestException({
          statusCode: 400,
          message: 'Merchant not found',
          error: 'MERCHANT_NOT_FOUND',
        });
      }

      const newUuid = randomUUID();
      const otp = this.generateAndLogOTP(newUuid);

      const newExpiry = this.calculateExpiryTime();

      await this.tempLinkDBService.createTempLink({
        uid: newUuid,
        phoneNumber: newUuid,
        merchantId: merchantId,
        expire: newExpiry,
        otp: otp,
      });

      this.logger.log(
        `[RegisterCustomerDev:L70] Created new temp link with uuid: ${newUuid}`,
      );

      return this.buildResponse(newUuid, merchantId, callbackUri);
    } catch (error) {
      return this.handleError(error);
    }
  }

  private generateAndLogOTP(phone: string): string {
    this.logger.log('[RegisterCustomerDev:L80] Generating OTP');

    const otp = this.otpService.generateOtp(6);

    this.logger.log(
      `[RegisterCustomerDev:L84] Generated OTP for phone ${phone}`,
    );

    return otp;
  }

  private calculateExpiryTime(): Date {
    return new Date(Date.now() + this.OTP_EXPIRY_MINUTES * 60 * 1000);
  }

  private buildResponse(
    requestId: string,
    merchantId: string,
    callbackUri?: string,
  ): RegistrationResponse {
    const baseUrl = this.configService.get<string>('FRONT_AUTHORIZE_OTP_URL');
    const callback = callbackUri || '';

    const url = `${baseUrl}/otp?requestid=${requestId}&merchantId=${merchantId}&callbackUri=${callback}`;

    this.logger.log(
      '[RegisterCustomerDev:L194] Registration completed successfully',
    );

    return {
      url,
      callbackUrl: callback,
      merchantId,
    };
  }

  private handleError(error: any): never {
    this.logger.error('[RegisterCustomerDev:L206] Error during registration');
    this.logger.error(`[RegisterCustomerDev:L207] ${error.message}`);

    if (
      error instanceof ConflictException ||
      error.status === 409 ||
      error.statusCode === 404
    ) {
      throw new NotFoundException({
        statusCode: 404,
        message: 'Customer already exists',
        error: 'CUSTOMER_EXISTS',
      });
    }

    throw new InternalServerErrorException(
      'Failed to register customer',
      error.message,
    );
  }
}
