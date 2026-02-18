jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { RegisterCustomerDev } from 'src/modules/internal/customer/handlers/registerCustomer.dev.handler';
import { CustomerDBService } from 'src/modules/internal/customer/services/customer-db.service';
import { ConfigService } from '@nestjs/config';
import { OTPService } from 'src/providers/otp/otp.service';
import { TempLinkDBService } from 'src/modules/internal/templink/service/templink-db.service';
import { MerchantDBService } from 'src/modules/internal/merchant/services/merchant-db.service';

describe('RegisterCustomerDev', () => {
  let handler: RegisterCustomerDev;
  let db: any;
  let configService: any;
  let otpService: any;
  let tempLinkDBService: any;
  let merchantDBService: any;

  beforeEach(() => {
    db = {};
    configService = { get: jest.fn() };
    otpService = { generateOTP: jest.fn() };
    tempLinkDBService = { createTempLink: jest.fn() };
    merchantDBService = { getMerchantById: jest.fn() };

    handler = new RegisterCustomerDev(
      db as unknown as CustomerDBService,
      configService as unknown as ConfigService,
      otpService as unknown as OTPService,
      tempLinkDBService as unknown as TempLinkDBService,
      merchantDBService as unknown as MerchantDBService,
    );
  });

  it('should throw InternalServerErrorException when merchant not found', async () => {
    merchantDBService.getMerchantById.mockResolvedValue(null);

    await expect(handler.execute('m1')).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  it('should create temp link and return registration URL', async () => {
    merchantDBService.getMerchantById.mockResolvedValue({
      id: 'm1',
      name: 'Merchant',
    });
    otpService.generateOTP.mockReturnValue('123456');
    tempLinkDBService.createTempLink.mockResolvedValue({});
    configService.get.mockReturnValue('https://front.example.com');

    const result = await handler.execute('m1', 'https://callback.example.com');

    expect(result.url).toContain('https://front.example.com/otp');
    expect(result.url).toContain('merchantId=m1');
    expect(result.callbackUrl).toBe('https://callback.example.com');
    expect(result.merchantId).toBe('m1');
    expect(tempLinkDBService.createTempLink).toHaveBeenCalled();
  });

  it('should use empty string for callback when not provided', async () => {
    merchantDBService.getMerchantById.mockResolvedValue({ id: 'm1' });
    otpService.generateOTP.mockReturnValue('654321');
    tempLinkDBService.createTempLink.mockResolvedValue({});
    configService.get.mockReturnValue('https://front.example.com');

    const result = await handler.execute('m1');

    expect(result.callbackUrl).toBe('');
  });

  it('should throw NotFoundException when ConflictException occurs (customer exists)', async () => {
    merchantDBService.getMerchantById.mockResolvedValue({ id: 'm1' });
    otpService.generateOTP.mockReturnValue('123456');
    tempLinkDBService.createTempLink.mockRejectedValue({
      status: 409,
      message: 'conflict',
    });

    await expect(handler.execute('m1')).rejects.toThrow(NotFoundException);
  });

  it('should throw InternalServerErrorException on generic error', async () => {
    merchantDBService.getMerchantById.mockResolvedValue({ id: 'm1' });
    otpService.generateOTP.mockReturnValue('123456');
    tempLinkDBService.createTempLink.mockRejectedValue(new Error('DB error'));

    await expect(handler.execute('m1')).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
