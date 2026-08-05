import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as http from 'node:http';
import * as https from 'node:https';
import * as net from 'node:net';
import { URL } from 'node:url';
import {
  AisSmsConnectivityCheck,
  AisSmsContentType,
  AisSmsDeliveryReport,
  AisSmsSendParams,
  AisSmsSendResult,
} from './types';

interface RawHttpResponse {
  status: number;
  statusText: string;
  ok: boolean;
  text: string;
}

/**
 * AIS SMS Gateway client (MT/DR) per the Service Parameter specification
 * (BDG_35145678001). Unlike the JSON-based OTP provider, this gateway speaks
 * application/x-www-form-urlencoded requests and XML responses.
 */
@Injectable()
export class AisSmsService {
  private readonly logger = new Logger(AisSmsService.name);
  private readonly apiUrl: string;
  private readonly from: string;
  private readonly charge: string;
  private readonly code: string;
  private readonly timeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    this.apiUrl = this.configService.get<string>('AIS_SMS_API_URL');
    this.from = this.configService.get<string>('AIS_SMS_FROM') || 'AIS';
    this.charge = this.configService.get<string>('AIS_SMS_CHARGE');
    this.code = this.configService.get<string>('AIS_SMS_CODE');
    this.timeoutMs = this.configService.get<number>('AIS_SMS_TIMEOUT_MS');

    console.log('[AisSmsService] constructor - config loaded:', {
      apiUrl: this.apiUrl,
      from: this.from,
      charge: this.charge,
      code: this.code,
      timeoutMs: this.timeoutMs,
    });
  }

  /**
   * Send an SMS via the AIS MT (Mobile Terminate) endpoint.
   * POST {apiUrl} CMD=SENDMSG&FROM=..&TO=..&REPORT=..&CHARGE=..&CODE=..&CTYPE=..&CONTENT=..
   */
  async sendMt(params: AisSmsSendParams): Promise<AisSmsSendResult> {
    console.log('[AisSmsService.sendMt] step 1 - params received:', params);

    const { to, content } = params;
    const ctype = params.ctype ?? this.detectContentType(content);
    const report = params.report === false ? 'N' : 'Y';
    const maskedTo = this.maskPhone(to);

    console.log('[AisSmsService.sendMt] step 2 - resolved values:', {
      maskedTo,
      ctype,
      report,
    });

    this.logger.log(`[MT] Sending SMS to ${maskedTo}, ctype=${ctype}`);

    const body = this.buildRequestBody({ to, content, ctype, report });

    console.log('[AisSmsService.sendMt] step 3 - request body built:', body);

    const egressIp = await this.getEgressIp();

    const tcpCheck = await this.checkTcpConnectivity(
      this.apiUrl,
      Math.min(this.timeoutMs, 10000),
    );

    console.log('[AisSmsService.sendMt] step 3a - TCP connectivity check:', {
      egressIp,
      ...tcpCheck,
    });

    try {
      console.log(
        `[AisSmsService.sendMt] step 4 - calling postForm: ${this.apiUrl} (egressIp=${egressIp ?? 'unknown'}, tcpConnected=${tcpCheck.connected})`,
      );

      const response = await this.postForm(this.apiUrl, body, this.timeoutMs);

      console.log('[AisSmsService.sendMt] step 5 - response received:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
      });

      const rawText = response.text;

      console.log(
        '[AisSmsService.sendMt] step 6 - raw response body:',
        rawText,
      );

      if (!response.ok) {
        console.error(
          '[AisSmsService.sendMt] step 6a - HTTP error branch:',
          response.status,
          response.statusText,
          rawText,
        );
        this.logger.error(
          `[MT] AIS gateway HTTP error: ${response.status} ${response.statusText}`,
          rawText,
        );
        throw new Error(
          `AIS gateway HTTP error: ${response.status} ${response.statusText}`,
        );
      }

      const result = this.parseSendResponse(rawText);

      console.log('[AisSmsService.sendMt] step 7 - parsed result:', result);

      if (result.success) {
        console.log(
          `[AisSmsService.sendMt] step 8 - success branch, smid=${result.smid}`,
        );
        this.logger.log(`[MT] SMS sent to ${maskedTo}, smid=${result.smid}`);
      } else {
        console.error(
          '[AisSmsService.sendMt] step 8 - rejected branch:',
          result.detail,
        );
        this.logger.error(
          `[MT] AIS gateway rejected message to ${maskedTo}: ${result.detail}`,
        );
      }

      console.log('[AisSmsService.sendMt] step 9 - returning result:', result);

      return result;
    } catch (error) {
      const message = this.getErrorMessage(error);

      console.error('[AisSmsService.sendMt] step ERROR - caught exception:', {
        maskedTo,
        egressIp,
        tcpCheck,
        message,
        stack: this.getErrorStack(error),
        error,
      });

      this.logger.error(
        `[MT] Error sending SMS to ${maskedTo} (egressIp=${egressIp ?? 'unknown'}, tcpConnected=${tcpCheck.connected}): ${message}`,
        this.getErrorStack(error),
      );
      throw new ServiceUnavailableException(`AIS SMS send failed: ${message}`);
    }
  }

  /**
   * Standalone connectivity probe (raw TCP connect, like `telnet host port`)
   * against the configured AIS gateway. Sends no HTTP request and no SMS, so
   * it can be polled freely to tell a network-level block apart from AIS
   * itself being unreachable, without spending a real MT request.
   */
  async checkConnectivity(): Promise<AisSmsConnectivityCheck> {
    const parsedUrl = new URL(this.apiUrl);
    const port =
      Number(parsedUrl.port) || (parsedUrl.protocol === 'https:' ? 443 : 80);

    const [egressIp, tcpCheck] = await Promise.all([
      this.getEgressIp(),
      this.checkTcpConnectivity(this.apiUrl, Math.min(this.timeoutMs, 10000)),
    ]);

    const result: AisSmsConnectivityCheck = {
      ...tcpCheck,
      host: parsedUrl.hostname,
      port,
      egressIp,
    };

    console.log('[AisSmsService.checkConnectivity] step 1 - result:', result);

    return result;
  }

  /**
   * Parse an inbound Delivery Report POST from AIS.
   * AIS sends: CMD=DLVRREP&NTYPE=REP&FROM=..&SMID=..&STATUS=OK|ERR&DETAIL=..
   * Pass the request body/query already parsed as key-value pairs.
   */
  parseDeliveryReport(payload: Record<string, string>): AisSmsDeliveryReport {
    console.log(
      '[AisSmsService.parseDeliveryReport] step 1 - payload received:',
      payload,
    );

    const result: AisSmsDeliveryReport = {
      ntype: payload.NTYPE,
      from: payload.FROM,
      smid: payload.SMID,
      status: payload.STATUS === 'OK' ? 'OK' : 'ERR',
      detail: payload.DETAIL,
    };

    if (result.status !== 'OK') {
      console.error(
        '[AisSmsService.parseDeliveryReport] step ERROR - non-OK delivery report:',
        result,
      );
    } else {
      console.log(
        '[AisSmsService.parseDeliveryReport] step 2 - parsed result:',
        result,
      );
    }

    return result;
  }

  /**
   * XML acknowledgement body AIS expects back after posting a Delivery Report.
   */
  buildDeliveryReportAckXml(): string {
    const ackXml = '<XML><STATUS>OK</STATUS><DETAIL></DETAIL></XML>';
    console.log(
      '[AisSmsService.buildDeliveryReportAckXml] step 1 - ack xml built:',
      ackXml,
    );
    return ackXml;
  }

  /**
   * Node's global fetch() (undici) enforces the WHATWG Fetch "bad port"
   * blocklist, which includes 10080 - the port AIS's TEST gateway listens
   * on. Using the low-level http/https module bypasses that fetch-specific
   * restriction while still speaking plain HTTP/HTTPS.
   */
  private postForm(
    url: string,
    body: string,
    timeoutMs: number,
  ): Promise<RawHttpResponse> {
    console.log('[AisSmsService.postForm] step 1 - request:', {
      url,
      body,
      timeoutMs,
    });

    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const client = parsedUrl.protocol === 'https:' ? https : http;
      let settled = false;

      const req = client.request(
        parsedUrl,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(body),
          },
          timeout: timeoutMs,
        },
        (res) => {
          let data = '';
          res.setEncoding('utf8');
          res.on('data', (chunk: string) => {
            data += chunk;
          });
          res.on('end', () => {
            if (settled) return;
            settled = true;
            const status = res.statusCode ?? 0;
            const result: RawHttpResponse = {
              status,
              statusText: res.statusMessage ?? '',
              ok: status >= 200 && status < 300,
              text: data,
            };
            console.log('[AisSmsService.postForm] step 2 - response:', result);
            resolve(result);
          });
        },
      );

      req.on('timeout', () => {
        console.error(
          `[AisSmsService.postForm] step ERROR - timed out after ${timeoutMs}ms connecting to ${url}`,
        );
        req.destroy(
          new Error(`Request to ${url} timed out after ${timeoutMs}ms`),
        );
      });

      req.on('error', (error) => {
        if (settled) return;
        settled = true;
        console.error('[AisSmsService.postForm] step ERROR - request:', error);
        reject(error);
      });

      req.write(body);
      req.end();
    });
  }

  /**
   * Opens a raw TCP connection to the gateway host/port without sending any
   * protocol data. This tells apart a network-level block (TCP itself never
   * connects - firewall/whitelist issue) from an application-level one (TCP
   * connects fine, but the AIS gateway never answers our HTTP request).
   * Uses Node's built-in `net` module only, so it adds no new dependency
   * (and therefore no new supply-chain surface) to the project.
   */
  private checkTcpConnectivity(
    url: string,
    timeoutMs: number,
  ): Promise<{ connected: boolean; error?: string }> {
    return new Promise((resolve) => {
      const parsedUrl = new URL(url);
      const port =
        Number(parsedUrl.port) || (parsedUrl.protocol === 'https:' ? 443 : 80);
      const socket = new net.Socket();
      let settled = false;

      const finish = (result: { connected: boolean; error?: string }) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        resolve(result);
      };

      socket.setTimeout(timeoutMs);
      socket.once('connect', () => finish({ connected: true }));
      socket.once('timeout', () =>
        finish({
          connected: false,
          error: `TCP connect timed out after ${timeoutMs}ms`,
        }),
      );
      socket.once('error', (error: Error) =>
        finish({ connected: false, error: error.message }),
      );

      socket.connect(port, parsedUrl.hostname);
    });
  }

  /**
   * Looks up this server's outbound public IP as seen externally. AIS's
   * gateway sits behind a NAT pool that can egress through any of several
   * whitelisted IPs, so logging this per-attempt makes it possible to
   * correlate a specific failed send with the IP it went out on.
   */
  private async getEgressIp(): Promise<string | null> {
    try {
      const res = await fetch('https://api.ipify.org?format=json');
      const data = (await res.json()) as { ip: string };
      console.log('[AisSmsService.getEgressIp] step 1 - egress IP:', data.ip);
      return data.ip;
    } catch (error) {
      console.error(
        '[AisSmsService.getEgressIp] step ERROR - lookup failed:',
        error,
      );
      return null;
    }
  }

  private detectContentType(content: string): AisSmsContentType {
    // eslint-disable-next-line no-control-regex
    const type = /[^\x00-\x7F]/.test(content) ? 'UNICODE' : 'TEXT';
    console.log(
      '[AisSmsService.detectContentType] step 1 - detected type:',
      type,
    );
    return type;
  }

  private buildRequestBody(params: {
    to: string;
    content: string;
    ctype: AisSmsContentType;
    report: 'Y' | 'N';
  }): string {
    console.log('[AisSmsService.buildRequestBody] step 1 - params:', params);

    const { to, content, ctype, report } = params;

    const encodedContent =
      ctype === 'UNICODE'
        ? this.encodeUnicodeContent(content)
        : encodeURIComponent(content);

    console.log(
      '[AisSmsService.buildRequestBody] step 2 - encoded content:',
      encodedContent,
    );

    const body = [
      'CMD=SENDMSG',
      `FROM=${encodeURIComponent(this.from)}`,
      `TO=${encodeURIComponent(to)}`,
      `REPORT=${report}`,
      `CHARGE=${encodeURIComponent(this.charge)}`,
      `CODE=${encodeURIComponent(this.code)}`,
      `CTYPE=${ctype}`,
      `CONTENT=${encodedContent}`,
    ].join('&');

    console.log('[AisSmsService.buildRequestBody] step 3 - final body:', body);

    return body;
  }

  /**
   * Thai (UNICODE) content must be sent as percent-encoded UTF-16BE bytes,
   * e.g. "AIS" -> %00%41%00%49%00%53 (spec §1.a example).
   * Buffer.from(.., 'utf16le') gives little-endian pairs; swap16() flips each
   * pair to big-endian, matching the spec's UTF-16BE requirement exactly.
   */
  private encodeUnicodeContent(content: string): string {
    console.log(
      '[AisSmsService.encodeUnicodeContent] step 1 - content:',
      content,
    );
    const utf16be = Buffer.from(content, 'utf16le').swap16();
    let encoded = '';
    for (const byte of utf16be) {
      encoded += `%${byte.toString(16).toUpperCase().padStart(2, '0')}`;
    }
    console.log(
      '[AisSmsService.encodeUnicodeContent] step 2 - encoded:',
      encoded,
    );
    return encoded;
  }

  private parseSendResponse(xml: string): AisSmsSendResult {
    console.log('[AisSmsService.parseSendResponse] step 1 - raw xml:', xml);

    const status = this.extractXmlTag(xml, 'STATUS') ?? 'ERR';
    const detail = this.extractXmlTag(xml, 'DETAIL') ?? '';
    const smid = this.extractXmlTag(xml, 'SMID') || null;

    const result = {
      success: status === 'OK',
      status,
      detail,
      smid,
      raw: xml,
    };

    if (!result.success) {
      console.error(
        '[AisSmsService.parseSendResponse] step ERROR - status not OK:',
        result,
      );
    } else {
      console.log('[AisSmsService.parseSendResponse] step 2 - parsed:', result);
    }

    return result;
  }

  private extractXmlTag(xml: string, tag: string): string | null {
    const match = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`, 'i'));
    const value = match ? match[1].trim() : null;

    if (value === null) {
      console.error(
        `[AisSmsService.extractXmlTag] step ERROR - tag <${tag}> not found in xml`,
      );
    } else {
      console.log(
        `[AisSmsService.extractXmlTag] step 1 - tag <${tag}> value:`,
        value,
      );
    }

    return value;
  }

  private maskPhone(phoneNumber: string): string {
    const masked = phoneNumber.replace(/(\d{3})\d+(\d{2})/, '$1***$2');
    console.log('[AisSmsService.maskPhone] step 1 - masked:', masked);
    return masked;
  }

  private getErrorMessage(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      '[AisSmsService.getErrorMessage] step ERROR - message:',
      message,
    );
    return message;
  }

  private getErrorStack(error: unknown): string | undefined {
    const stack = error instanceof Error ? error.stack : undefined;
    console.error('[AisSmsService.getErrorStack] step ERROR - stack:', stack);
    return stack;
  }
}
