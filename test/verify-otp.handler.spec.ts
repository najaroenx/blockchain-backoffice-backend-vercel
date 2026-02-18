jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { VerifyOTP } from 'src/modules/internal/templink/handlers/verifyOTP.handler';
import { TempLinkDBService } from 'src/modules/internal/templink/service/templink-db.service';

describe('VerifyOTP', () => {
  let handler: VerifyOTP;
  let tempLinkDB: jest.Mocked<TempLinkDBService>;

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
      getTempLinkByPhoneNumber: jest.fn(),
      deleteTempLink: jest.fn(),
    } as any;
    handler = new VerifyOTP(tempLinkDB);
    jest.clearAllMocks();
  });

  it('should verify OTP and return temp link details', async () => {
    tempLinkDB.getTempLinkByPhoneNumber.mockResolvedValue(mockTempLink as any);
    tempLinkDB.deleteTempLink.mockResolvedValue(mockTempLink as any);

    const result = await handler.execute('0812345678', '123456');

    expect(result.uid).toBe('uid-abc');
    expect(result.phoneNumber).toBe('0812345678');
    expect(result.merchantId).toBe('merchant-1');
    expect(tempLinkDB.deleteTempLink).toHaveBeenCalledWith('uid-abc');
  });

  it('should throw NotFoundException when temp link not found', async () => {
    tempLinkDB.getTempLinkByPhoneNumber.mockResolvedValue(null);

    await expect(handler.execute('0000000000', '123456')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should throw BadRequestException when temp link is expired', async () => {
    const expired = {
      ...mockTempLink,
      expire: new Date(Date.now() - 86400000),
    };
    tempLinkDB.getTempLinkByPhoneNumber.mockResolvedValue(expired as any);

    await expect(handler.execute('0812345678', '123456')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should throw BadRequestException when no OTP exists', async () => {
    const noOtp = { ...mockTempLink, otp: null };
    tempLinkDB.getTempLinkByPhoneNumber.mockResolvedValue(noOtp as any);

    await expect(handler.execute('0812345678', '123456')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should throw BadRequestException on invalid OTP', async () => {
    tempLinkDB.getTempLinkByPhoneNumber.mockResolvedValue(mockTempLink as any);

    await expect(handler.execute('0812345678', 'wrong-otp')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should throw BadRequestException on unexpected error', async () => {
    tempLinkDB.getTempLinkByPhoneNumber.mockRejectedValue(
      new Error('DB error'),
    );

    await expect(handler.execute('0812345678', '123456')).rejects.toThrow(
      BadRequestException,
    );
  });
});
