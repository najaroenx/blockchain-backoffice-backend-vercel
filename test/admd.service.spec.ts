import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { AdmdService } from '../src/providers/admd/admd.service';

global.fetch = jest.fn();

describe('AdmdService', () => {
  let service: AdmdService;
  const mockConfigService = {
    get: jest.fn((key: string) => {
      const map: Record<string, string> = {
        ADMD_TOKEN_URL: 'https://admd.example.com/token',
        ADMD_CLIENT_ID: 'client_id_123',
        ADMD_CLIENT_SECRET: 'client_secret_abc',
      };
      return map[key];
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AdmdService(mockConfigService as unknown as ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getAccessToken', () => {
    const tokenResponse = {
      access_token: 'tok_abc123',
      token_type: 'Bearer',
      expires_in: 3600,
    };

    it('should request and return a new token when no cache', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(tokenResponse),
      });

      const token = await service.getAccessToken();

      expect(token).toBe('tok_abc123');
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://admd.example.com/token',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: expect.stringContaining('grant_type=client_credentials'),
        }),
      );
    });

    it('should include client_id and client_secret in body', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(tokenResponse),
      });

      await service.getAccessToken();

      const body: string = (global.fetch as jest.Mock).mock.calls[0][1].body;
      expect(body).toContain('client_id=client_id_123');
      expect(body).toContain('client_secret=client_secret_abc');
    });

    it('should return cached token on second call within TTL', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(tokenResponse),
      });

      const first = await service.getAccessToken();
      const second = await service.getAccessToken();

      expect(first).toBe('tok_abc123');
      expect(second).toBe('tok_abc123');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should throw ServiceUnavailableException when response is not ok', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: jest.fn().mockResolvedValue('error body'),
      });

      await expect(service.getAccessToken()).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('should throw ServiceUnavailableException when fetch throws', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('Network error'),
      );

      await expect(service.getAccessToken()).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('should rethrow ServiceUnavailableException directly', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        text: jest.fn().mockResolvedValue(''),
      });

      await expect(service.getAccessToken()).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });

    it('should fetch new token after cache is cleared', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest
          .fn()
          .mockResolvedValueOnce(tokenResponse)
          .mockResolvedValueOnce({ ...tokenResponse, access_token: 'tok_new' }),
      });

      await service.getAccessToken();
      service.clearCache();
      const second = await service.getAccessToken();

      expect(second).toBe('tok_new');
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should handle response.text() failure on error gracefully', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: jest.fn().mockRejectedValue(new Error('cannot read body')),
      });

      await expect(service.getAccessToken()).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('clearCache', () => {
    it('should allow token re-fetch after clearing cache', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          access_token: 'tok_1',
          token_type: 'Bearer',
          expires_in: 3600,
        }),
      });

      await service.getAccessToken();
      service.clearCache();

      expect(global.fetch).toHaveBeenCalledTimes(1);
      await service.getAccessToken();
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should not throw when clearing an already-empty cache', () => {
      expect(() => service.clearCache()).not.toThrow();
    });
  });
});
