import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AisTransferService } from '../src/providers/ais-transfer/ais-transfer.service';

global.fetch = jest.fn();

describe('AisTransferService', () => {
  let service: AisTransferService;
  let mockAdmdService: any;
  let mockConfigService: ConfigService;
  let mockPrisma: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockAdmdService = {
      getAccessToken: jest.fn().mockResolvedValue('token-123'),
      clearCache: jest.fn(),
    };

    mockConfigService = {
      get: jest.fn((key: string) => {
        const config = {
          AIS_TRANSFER_BASE_URL: 'https://ais.example.com',
          AIS_TRANSFER_USERNAME: 'user',
          AIS_TRANSFER_PASSWORD: 'pass',
          AIS_TRANSFER_REFERENCE_CODE: 'ref-code',
        };

        return config[key];
      }),
    } as unknown as ConfigService;

    mockPrisma = {
      aisTransferLog: {
        create: jest.fn().mockResolvedValue({ id: 'log-1' }),
      },
    };

    service = new AisTransferService(
      mockAdmdService,
      mockConfigService,
      mockPrisma,
    );
  });

  afterEach(() => {
    (global.fetch as jest.Mock).mockReset();
  });

  it('treats status 20000 as success and logs success true', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: jest.fn().mockResolvedValue({ status: '20000', message: 'done' }),
    });

    const result = await service.transferIn({
      transactionID: 'txn-1',
      msisdn: '0899999999',
      points: 50,
    });

    expect(result.success).toBe(true);
    expect(mockPrisma.aisTransferLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          transactionID: 'txn-1',
          success: true,
          httpStatus: 200,
        }),
      }),
    );
  });

  it('treats non-20000 AIS body status as failure even when HTTP is 200', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: jest
        .fn()
        .mockResolvedValue({ status: '40010', message: 'invalid msisdn' }),
    });

    const result = await service.transferIn({
      transactionID: 'txn-2',
      msisdn: '0899999999',
      points: 50,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('AIS status=40010');
    expect(mockPrisma.aisTransferLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          transactionID: 'txn-2',
          success: false,
          httpStatus: 200,
        }),
      }),
    );
  });

  it('retries once on HTTP 401 before succeeding', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: jest
          .fn()
          .mockResolvedValue({ status: '40100', message: 'expired token' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: jest.fn().mockResolvedValue({ status: '20000', message: 'done' }),
      });

    const result = await service.transferIn({
      transactionID: 'txn-3',
      msisdn: '0899999999',
      points: 50,
    });

    expect(result.success).toBe(true);
    expect(mockAdmdService.clearCache).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('throws ServiceUnavailableException on transport failure', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('network down'));

    await expect(
      service.transferReverse({
        transactionID: 'txn-4',
        msisdn: '0899999999',
      }),
    ).rejects.toThrow(ServiceUnavailableException);
  });
});
