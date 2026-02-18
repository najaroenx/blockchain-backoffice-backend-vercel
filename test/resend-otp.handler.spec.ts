jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ReSendOTP } from 'src/modules/internal/templink/handlers/reSendOTP.handler';
import { TempLinkDBService } from 'src/modules/internal/templink/service/templink-db.service';
import { OTPService } from 'src/providers/otp/otp.service';

describe('ReSendOTP', () => {
  let handler: ReSendOTP;
  let tempLinkDB: jest.Mocked<TempLinkDBService>;
  let otpService: jest.Mocked<OTPService>;

  const mockTempLink = {
    id: 'tl-1',
    uid: 'uid-abc',
    phoneNumber: '0812345678',
    merchantId: 'merchant-1',
    otp: '123456',
    expire: new Date(Date.now() + 86400000),
  };

  beforeEach(() => {
    tempLinkDB = {
      getTempLinkByUid: jest.fn(),
      updateTempLink: jest.fn(),
    } as any;
    otpService = {
      generateOTP: jest.fn().mockReturnValue('654321'),
      sendOTP: jest.fn(),
    } as any;
    handler = new ReSendOTP(tempLinkDB, otpService);
    jest.clearAllMocks();
  });

  it('should resend OTP successfully', async () => {
    tempLinkDB.getTempLinkByUid.mockResolvedValue(mockTempLink as any);
    tempLinkDB.updateTempLink.mockResolvedValue(mockTempLink as any);
    otpService.sendOTP.mockResolvedValue(undefined);

    const result = await handler.execute('uid-abc');

    expect(otpService.generateOTP).toHaveBeenCalledWith(6);
    expect(tempLinkDB.updateTempLink).toHaveBeenCalledWith(
      'uid-abc',
      expect.objectContaining({
        otp: '654321',
        expire: expect.any(Date),
      }),
    );
    expect(otpService.sendOTP).toHaveBeenCalledWith('0812345678', '654321');
    expect(result.success).toBe(true);
    expect(result.message).toBe('OTP resent successfully');
  });

  it('should throw NotFoundException when temp link not found', async () => {
    tempLinkDB.getTempLinkByUid.mockResolvedValue(null);

    await expect(handler.execute('nonexistent')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should throw BadRequestException when temp link expired', async () => {
    const expired = {
      ...mockTempLink,
      expire: new Date(Date.now() - 86400000),
    };
    tempLinkDB.getTempLinkByUid.mockResolvedValue(expired as any);

    await expect(handler.execute('uid-abc')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should throw BadRequestException when no phone number', async () => {
    const noPhone = { ...mockTempLink, phoneNumber: null };
    tempLinkDB.getTempLinkByUid.mockResolvedValue(noPhone as any);

    await expect(handler.execute('uid-abc')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should throw BadRequestException on send failure', async () => {
    tempLinkDB.getTempLinkByUid.mockResolvedValue(mockTempLink as any);
    tempLinkDB.updateTempLink.mockResolvedValue(mockTempLink as any);
    otpService.sendOTP.mockRejectedValue(new Error('SMS failed'));

    await expect(handler.execute('uid-abc')).rejects.toThrow(
      BadRequestException,
    );
  });
});
