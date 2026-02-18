jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));
import { InternalServerErrorException } from '@nestjs/common';
import { CreateOTP } from 'src/modules/internal/templink/handlers/createOTP.handler';
import { TempLinkDBService } from 'src/modules/internal/templink/service/templink-db.service';
import { OTPService } from 'src/providers/otp/otp.service';

describe('CreateOTP', () => {
  let handler: CreateOTP;
  let tempLinkDB: jest.Mocked<TempLinkDBService>;
  let otpService: jest.Mocked<OTPService>;

  const mockTempLink = {
    id: 'tl-1',
    uid: 'uid-abc',
    phoneNumber: '0812345678',
    merchantId: 'merchant-1',
    otp: '123456',
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
      sendOTP: jest.fn(),
    } as any;
    handler = new CreateOTP(tempLinkDB, otpService);
    jest.clearAllMocks();
  });

  it('should send OTP successfully', async () => {
    tempLinkDB.getTempLinkByUid.mockResolvedValue(mockTempLink as any);
    tempLinkDB.updateTempLink.mockResolvedValue(mockTempLink as any);
    otpService.sendOTP.mockResolvedValue(undefined);

    const result = await handler.execute('uid-abc', '0899999999');

    expect(tempLinkDB.getTempLinkByUid).toHaveBeenCalledWith('uid-abc');
    expect(tempLinkDB.updateTempLink).toHaveBeenCalled();
    expect(otpService.sendOTP).toHaveBeenCalledWith('0899999999', '123456');
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
    otpService.sendOTP.mockRejectedValue(new Error('SMS failed'));

    await expect(handler.execute('uid-abc', '0812345678')).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
