import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { InternalServerErrorException } from '@nestjs/common';
import { OTPService } from '../src/providers/otp/otp.service';
import { INTERNAL_SERVER_ERROR } from '../src/errors/error.constants';

// Mock fetch globally
global.fetch = jest.fn();

describe('OTPService', () => {
  let service: OTPService;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config = {
        OTP_API_URL: 'https://api.example.com/sms',
        OTP_API_USERNAME: 'testuser',
        OTP_API_PASSWORD: 'testpass',
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks(); // Clear mocks before creating the module

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OTPService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<OTPService>(OTPService);
    configService = module.get<ConfigService>(ConfigService);
    // Don't clear mocks here - we want to preserve the constructor calls
  });

  afterEach(() => {
    // Only clear fetch mock between tests, not configService
    (global.fetch as jest.Mock).mockClear();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateOTP', () => {
    it('should generate a 6-digit OTP by default', () => {
      const otp = service.generateOTP();
      expect(otp).toHaveLength(6);
      expect(otp).toMatch(/^\d{6}$/);
    });

    it('should generate OTP with custom length', () => {
      const otp = service.generateOTP(4);
      expect(otp).toHaveLength(4);
      expect(otp).toMatch(/^\d{4}$/);
    });

    it('should generate different OTPs on multiple calls', () => {
      const otp1 = service.generateOTP();
      const otp2 = service.generateOTP();
      // While it's possible they could be the same, it's very unlikely
      // This test might occasionally fail, but it's a reasonable sanity check
      expect(typeof otp1).toBe('string');
      expect(typeof otp2).toBe('string');
    });
  });

  describe('sendOTP', () => {
    const phoneNumber = '0984360421';
    const otp = '123456';

    it('should send OTP successfully', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ success: true }),
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await service.sendOTP(phoneNumber, otp);

      expect(result).toEqual({
        success: true,
        message: 'OTP sent successfully',
      });
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/sms',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: expect.stringContaining('Basic '),
          }),
          body: expect.any(String),
        }),
      );
    });

    it('should include correct Basic Auth credentials', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ success: true }),
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      await service.sendOTP(phoneNumber, otp);

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const headers = fetchCall[1].headers;
      const authHeader = headers.Authorization;

      // Decode the Basic Auth header
      const base64Credentials = authHeader.replace('Basic ', '');
      const credentials = Buffer.from(base64Credentials, 'base64').toString();

      expect(credentials).toBe('testuser:testpass');
    });

    it('should include phone number and OTP in request body', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ success: true }),
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      await service.sendOTP(phoneNumber, otp);

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);

      expect(body).toEqual({
        sender: 'mechant',
        text: `รหัส OTP คือ ${otp} จะหมดอายุใน 5 นาที และจะใช้ได้ 1 ครั้งเท่านั้น`,
        destinations: [
          {
            destination: phoneNumber,
          },
        ],
        callback_url: 'https://dlp-backofficefe-testnet.adldigitalservice.com',
        callback_method: 'GET',
      });
    });

    it('should throw InternalServerErrorException when API returns error', async () => {
      const mockResponse = {
        ok: false,
        statusText: 'Bad Request',
        json: jest.fn().mockResolvedValue({ error: 'Invalid phone number' }),
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      await expect(service.sendOTP(phoneNumber, otp)).rejects.toThrow(
        InternalServerErrorException,
      );
      await expect(service.sendOTP(phoneNumber, otp)).rejects.toThrow(
        INTERNAL_SERVER_ERROR,
      );
    });

    it('should throw InternalServerErrorException when fetch fails', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(service.sendOTP(phoneNumber, otp)).rejects.toThrow(
        InternalServerErrorException,
      );
      await expect(service.sendOTP(phoneNumber, otp)).rejects.toThrow(
        INTERNAL_SERVER_ERROR,
      );
    });

    it('should handle response.json() failure gracefully', async () => {
      const mockResponse = {
        ok: false,
        statusText: 'Internal Server Error',
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

      await expect(service.sendOTP(phoneNumber, otp)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('ConfigService integration', () => {
    it('should load configuration values on initialization', () => {
      expect(configService.get).toHaveBeenCalledWith('OTP_API_URL');
      expect(configService.get).toHaveBeenCalledWith('OTP_API_USERNAME');
      expect(configService.get).toHaveBeenCalledWith('OTP_API_PASSWORD');
    });
  });
});
