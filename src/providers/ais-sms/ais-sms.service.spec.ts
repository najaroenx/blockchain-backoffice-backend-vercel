import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { AisSmsService } from './ais-sms.service';

const CONFIG: Record<string, string> = {
  AIS_SMS_API_URL: 'https://110.49.202.49:10443/',
  AIS_SMS_FROM: 'AIS',
  AIS_SMS_CHARGE: '66614143821',
  AIS_SMS_CODE: '35145678001',
};

describe('AisSmsService', () => {
  let service: AisSmsService;
  let fetchMock: jest.Mock;

  beforeEach(async () => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AisSmsService,
        {
          provide: ConfigService,
          useValue: { get: (key: string) => CONFIG[key] },
        },
      ],
    }).compile();

    service = module.get(AisSmsService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('sendMt', () => {
    it('sends a TEXT MT request and parses a successful XML response', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        text: () =>
          Promise.resolve(
            '<XML><STATUS>OK</STATUS><DETAIL>SUCCESS</DETAIL><SMID>1357412663</SMID></XML>',
          ),
      });

      const result = await service.sendMt({
        to: '66818452233',
        content: 'AIS_TEST',
      });

      expect(result).toEqual({
        success: true,
        status: 'OK',
        detail: 'SUCCESS',
        smid: '1357412663',
        raw: '<XML><STATUS>OK</STATUS><DETAIL>SUCCESS</DETAIL><SMID>1357412663</SMID></XML>',
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(CONFIG.AIS_SMS_API_URL);
      expect(init.method).toBe('POST');
      expect(init.headers['Content-Type']).toBe(
        'application/x-www-form-urlencoded',
      );
      expect(init.body).toBe(
        'CMD=SENDMSG&FROM=AIS&TO=66818452233&REPORT=Y&CHARGE=66614143821&CODE=35145678001&CTYPE=TEXT&CONTENT=AIS_TEST',
      );
    });

    it('auto-detects Thai content as UNICODE and percent-encodes it as UTF-16BE', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        text: () =>
          Promise.resolve(
            '<XML><STATUS>OK</STATUS><DETAIL>SUCCESS</DETAIL><SMID>1</SMID></XML>',
          ),
      });

      await service.sendMt({ to: '66818452233', content: 'AIS ทดสอบ' });

      const [, init] = fetchMock.mock.calls[0];
      expect(init.body).toContain('CTYPE=UNICODE');
      expect(init.body).toContain(
        'CONTENT=%00%41%00%49%00%53%00%20%0E%17%0E%14%0E%2A%0E%2D%0E%1A',
      );
    });

    it('honors an explicit ctype override', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        text: () =>
          Promise.resolve(
            '<XML><STATUS>OK</STATUS><DETAIL>SUCCESS</DETAIL></XML>',
          ),
      });

      await service.sendMt({
        to: '66818452233',
        content: 'AIS_TEST',
        ctype: 'UNICODE',
      });

      const [, init] = fetchMock.mock.calls[0];
      expect(init.body).toContain('CTYPE=UNICODE');
    });

    it('sends REPORT=N when report is explicitly disabled', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        text: () =>
          Promise.resolve(
            '<XML><STATUS>OK</STATUS><DETAIL>SUCCESS</DETAIL></XML>',
          ),
      });

      await service.sendMt({
        to: '66818452233',
        content: 'AIS_TEST',
        report: false,
      });

      const [, init] = fetchMock.mock.calls[0];
      expect(init.body).toContain('REPORT=N');
    });

    it('returns a failed result when AIS responds with a business error', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        text: () =>
          Promise.resolve(
            '<XML><STATUS>ERR</STATUS><DETAIL>CORP:INVALID_FROM</DETAIL><SMID></SMID></XML>',
          ),
      });

      const result = await service.sendMt({
        to: '66818452233',
        content: 'AIS_TEST',
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe('ERR');
      expect(result.detail).toBe('CORP:INVALID_FROM');
      expect(result.smid).toBeNull();
    });

    it('throws ServiceUnavailableException on an HTTP error response', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: () => Promise.resolve(''),
      });

      await expect(
        service.sendMt({ to: '66818452233', content: 'AIS_TEST' }),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('throws ServiceUnavailableException when the network request fails', async () => {
      fetchMock.mockRejectedValue(new Error('fetch failed'));

      await expect(
        service.sendMt({ to: '66818452233', content: 'AIS_TEST' }),
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('parseDeliveryReport', () => {
    it('parses a successful delivery report payload', () => {
      const report = service.parseDeliveryReport({
        NTYPE: 'REP',
        FROM: '66818452233',
        SMID: '1501370867874',
        STATUS: 'OK',
        DETAIL: 'DELIVRD',
      });

      expect(report).toEqual({
        ntype: 'REP',
        from: '66818452233',
        smid: '1501370867874',
        status: 'OK',
        detail: 'DELIVRD',
      });
    });

    it('normalizes any non-OK status to ERR', () => {
      const report = service.parseDeliveryReport({
        NTYPE: 'REP',
        FROM: '66615379275',
        SMID: '1501370867889',
        STATUS: 'ERR',
        DETAIL: 'EXPIRED',
      });

      expect(report.status).toBe('ERR');
      expect(report.detail).toBe('EXPIRED');
    });
  });

  describe('buildDeliveryReportAckXml', () => {
    it('returns the XML acknowledgement AIS expects', () => {
      expect(service.buildDeliveryReportAckXml()).toBe(
        '<XML><STATUS>OK</STATUS><DETAIL></DETAIL></XML>',
      );
    });
  });
});
