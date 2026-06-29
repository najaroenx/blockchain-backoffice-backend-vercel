jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));
import { InternalServerErrorException } from '@nestjs/common';
import { CreateOTP } from 'src/modules/internal/templink/handlers/createOTP.handler';
import { TempLinkDBService } from 'src/modules/internal/templink/service/templink-db.service';
import { OtpService } from 'src/modules/internal/otp/otp.service';

describe('CreateOTP', () => {
  let handler: CreateOTP;
  let tempLinkDB: jest.Mocked<TempLinkDBService>;
  let otpService: jest.Mocked<OtpService>;

  const mockTempLink = {
    id: 'tl-1',
    uid: 'uid-abc',
    phoneNumber: '0812345678',
    merchantId: 'merchant-1',
    otp: 'hashed_otp',
    expire: new Date(Date.now() + 86400000),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    tempLinkDB = {
      getTempLinkByUid: jest.fn(),
      updateTempLink: jest.fn(),
    } as any;
    otpService = {
      generateOtp: jest.fn().mockReturnValue('123456'),
      hashOtp: jest.fn().mockReturnValue('hashed_123456'),
      sendOtp: jest
        .fn()
        .mockResolvedValue({ success: true, message: 'OTP sent successfully' }),
    } as any;
    handler = new CreateOTP(tempLinkDB, otpService);
    jest.clearAllMocks();
  });

  it('should generate, hash, store, and send OTP successfully', async () => {
    otpService.generateOtp.mockReturnValue('123456');
    otpService.hashOtp.mockReturnValue('hashed_123456');
    tempLinkDB.getTempLinkByUid.mockResolvedValue(mockTempLink as any);
    tempLinkDB.updateTempLink.mockResolvedValue(mockTempLink as any);
    otpService.sendOtp.mockResolvedValue({
      success: true,
      message: 'OTP sent successfully',
    });

    const result = await handler.execute('uid-abc', '0899999999');

    expect(tempLinkDB.getTempLinkByUid).toHaveBeenCalledWith('uid-abc');
    expect(otpService.generateOtp).toHaveBeenCalledWith(6);
    expect(otpService.hashOtp).toHaveBeenCalledWith('123456');
    expect(tempLinkDB.updateTempLink).toHaveBeenCalledWith('uid-abc', {
      phoneNumber: '0899999999',
      otp: 'hashed_123456',
    });
    expect(otpService.sendOtp).toHaveBeenCalledWith('0899999999', '123456');
    expect(result.success).toBe(true);
    expect(result.message).toBe('OTP sent successfully');
  });

  it('should throw when temp link not found', async () => {
    tempLinkDB.getTempLinkByUid.mockResolvedValue(null);

    await expect(handler.execute('nonexistent', '0812345678')).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  it('should throw when temp link is expired', async () => {
    const expiredLink = {
      ...mockTempLink,
      expire: new Date(Date.now() - 86400000),
    };
    tempLinkDB.getTempLinkByUid.mockResolvedValue(expiredLink as any);

    await expect(handler.execute('uid-abc', '0812345678')).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  it('should throw InternalServerErrorException on OTP send failure', async () => {
    tempLinkDB.getTempLinkByUid.mockResolvedValue(mockTempLink as any);
    tempLinkDB.updateTempLink.mockResolvedValue(mockTempLink as any);
    otpService.sendOtp.mockRejectedValue(new Error('SMS failed'));

    await expect(handler.execute('uid-abc', '0812345678')).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
