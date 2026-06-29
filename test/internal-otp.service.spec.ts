import { ConfigService } from '@nestjs/config';
import { InternalServerErrorException } from '@nestjs/common';
import { OtpService } from '../src/modules/internal/otp/otp.service';
import { INTERNAL_SERVER_ERROR } from '../src/errors/error.constants';

global.fetch = jest.fn();

describe('OtpService (modules/internal/otp)', () => {
  let service: OtpService;
  const mockConfigService = {
    get: jest.fn((key: string) => {
      const map: Record<string, string> = {
        OTP_API_URL: 'https://sms.example.com/send',
        OTP_API_USERNAME: 'smsuser',
        OTP_API_PASSWORD: 'smspass',
      };
      return map[key];
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new OtpService(mockConfigService as unknown as ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateOtp', () => {
    it('should generate a 6-digit OTP by default', () => {
      const otp = service.generateOtp();
      expect(otp).toHaveLength(6);
      expect(otp).toMatch(/^\d{6}$/);
    });

    it('should generate OTP with custom length', () => {
      const otp = service.generateOtp(4);
      expect(otp).toHaveLength(4);
      expect(otp).toMatch(/^\d{4}$/);
    });

    it('should only contain digits', () => {
      for (let i = 0; i < 20; i++) {
        expect(service.generateOtp()).toMatch(/^\d+$/);
      }
    });

    it('should return empty string when length is 0', () => {
      expect(service.generateOtp(0)).toBe('');
    });
  });

  describe('hashOtp', () => {
    it('should return a 64-char hex SHA-256 hash', () => {
      const hash = service.hashOtp('123456');
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should return same hash for same input', () => {
      expect(service.hashOtp('123456')).toBe(service.hashOtp('123456'));
    });

    it('should return different hash for different input', () => {
      expect(service.hashOtp('123456')).not.toBe(service.hashOtp('654321'));
    });
  });

  describe('compareOtp', () => {
    it('should return true when hashes match', () => {
      const otp = '123456';
      const hash = service.hashOtp(otp);
      expect(service.compareOtp(hash, otp)).toBe(true);
    });

    it('should return false for wrong OTP', () => {
      const hash = service.hashOtp('123456');
      expect(service.compareOtp(hash, '000000')).toBe(false);
    });

    it('should return false when lengths differ', () => {
      const shortHash = 'abc';
      expect(service.compareOtp(shortHash, '123456')).toBe(false);
    });
  });

  describe('sendOtp', () => {
    const phone = '0812345678';
    const otp = '456789';

    it('should send OTP and return success', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ success: true }),
      });

      const result = await service.sendOtp(phone, otp);

      expect(result).toEqual({
        success: true,
        message: 'OTP sent successfully',
      });
      expect(global.fetch).toHaveBeenCalledWith(
        'https://sms.example.com/send',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('should include correct Authorization header', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ success: true }),
      });

      await service.sendOtp(phone, otp);

      const headers = (global.fetch as jest.Mock).mock.calls[0][1].headers;
      const expectedCredentials =
        Buffer.from('smsuser:smspass').toString('base64');
      expect(headers.Authorization).toBe(`Basic ${expectedCredentials}`);
    });

    it('should send OTP text in request body', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({ success: true }),
      });

      await service.sendOtp(phone, otp);

      const body = JSON.parse(
        (global.fetch as jest.Mock).mock.calls[0][1].body,
      );
      expect(body.text).toContain(otp);
      expect(body.destinations[0].destination).toBe(phone);
    });

    it('should throw InternalServerErrorException on HTTP error response', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        statusText: 'Bad Request',
        json: jest.fn().mockResolvedValue({}),
      });

      await expect(service.sendOtp(phone, otp)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should throw InternalServerErrorException when fetch throws', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('Connection refused'),
      );

      await expect(service.sendOtp(phone, otp)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should throw InternalServerErrorException when SMS API returns success=false', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest
          .fn()
          .mockResolvedValue({ success: false, message: 'Invalid phone' }),
      });

      await expect(service.sendOtp(phone, otp)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should handle response.json() failure gracefully on HTTP error', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error',
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
      });

      await expect(service.sendOtp(phone, otp)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
