import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as dns from 'node:dns';
import * as http from 'node:http';
import * as https from 'node:https';
import * as net from 'node:net';
import { URL } from 'node:url';
import {
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

export interface TelnetCheckResult {
  host: string;
  port: number;
  reachable: boolean;
  durationMs: number;
  error?: string;
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

  constructor(private readonly configService: ConfigService) {
    this.apiUrl = this.configService.get<string>('AIS_SMS_API_URL');
    this.from = this.configService.get<string>('AIS_SMS_FROM') || 'AIS';
    this.charge = this.configService.get<string>('AIS_SMS_CHARGE');
    this.code = this.configService.get<string>('AIS_SMS_CODE');

    console.log('[AisSmsService] constructor - config loaded:', {
      apiUrl: this.apiUrl,
      from: this.from,
      charge: this.charge,
      code: this.code,
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

    try {
      console.log(
        `[AisSmsService.sendMt] step 4 - calling postForm: ${this.apiUrl}`,
      );

      const response = await this.postForm(this.apiUrl, body);

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
        message,
        stack: this.getErrorStack(error),
        error,
      });

      this.logger.error(
        `[MT] Error sending SMS to ${maskedTo}: ${message}`,
        this.getErrorStack(error),
      );
      throw new ServiceUnavailableException(`AIS SMS send failed: ${message}`);
    }
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
    timeoutMs = 15000,
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
   * Raw TCP connectivity probe, equivalent to `telnet host port`. Bypasses
   * HTTP entirely so it isolates network/firewall reachability from
   * anything the AIS gateway itself might do at the HTTP layer.
   *
   * `host` is caller-supplied (exposed via a public endpoint), so before
   * connecting we resolve it and refuse private/loopback/link-local
   * targets - otherwise this becomes an SSRF primitive for scanning the
   * internal network (e.g. cloud metadata at 169.254.169.254).
   */
  telnetCheck(
    host: string,
    port: number,
    timeoutMs = 5000,
  ): Promise<TelnetCheckResult> {
    console.log('[AisSmsService.telnetCheck] step 1 - probing:', {
      host,
      port,
      timeoutMs,
    });

    const startedAt = Date.now();
    const literalIp = net.isIP(host) ? host : null;

    if (literalIp) {
      if (this.isPrivateOrReservedIp(literalIp)) {
        return Promise.resolve(
          this.blockedTelnetResult(host, port, startedAt),
        );
      }
      return this.connectSocket(host, port, timeoutMs, startedAt);
    }

    return dns.promises
      .lookup(host)
      .then(({ address }) => {
        if (this.isPrivateOrReservedIp(address)) {
          return this.blockedTelnetResult(host, port, startedAt);
        }
        return this.connectSocket(host, port, timeoutMs, startedAt);
      })
      .catch((error) => {
        const message = this.getErrorMessage(error);
        console.error(
          '[AisSmsService.telnetCheck] step ERROR - DNS lookup failed:',
          { host, message },
        );
        return {
          host,
          port,
          reachable: false,
          durationMs: Date.now() - startedAt,
          error: message,
        };
      });
  }

  private blockedTelnetResult(
    host: string,
    port: number,
    startedAt: number,
  ): TelnetCheckResult {
    const message = `Refusing to probe private/reserved address: ${host}`;
    console.error(
      '[AisSmsService.telnetCheck] step ERROR - blocked private/reserved target:',
      { host, port },
    );
    return {
      host,
      port,
      reachable: false,
      durationMs: Date.now() - startedAt,
      error: message,
    };
  }

  /**
   * IPv4/IPv6 ranges reserved for loopback, private networks, link-local
   * (incl. cloud metadata endpoints), and multicast/reserved space. Fails
   * closed on unrecognized formats.
   */
  private isPrivateOrReservedIp(ip: string): boolean {
    if (net.isIPv4(ip)) {
      const parts = ip.split('.').map(Number);
      const [a, b] = parts;
      if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) {
        return true;
      }
      if (a === 0 || a === 10 || a === 127) return true;
      if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
      if (a === 169 && b === 254) return true; // link-local / cloud metadata
      if (a === 172 && b >= 16 && b <= 31) return true; // private
      if (a === 192 && b === 168) return true; // private
      if (a >= 224) return true; // multicast/reserved
      return false;
    }

    if (net.isIPv6(ip)) {
      const lower = ip.toLowerCase();
      if (lower === '::1' || lower === '::') return true;
      if (/^fe[89ab]/.test(lower)) return true; // link-local fe80::/10
      if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique local fc00::/7
      if (lower.startsWith('::ffff:')) {
        const embeddedV4 = lower.split(':').pop() ?? '';
        if (net.isIPv4(embeddedV4)) {
          return this.isPrivateOrReservedIp(embeddedV4);
        }
      }
      return false;
    }

    return true;
  }

  private connectSocket(
    host: string,
    port: number,
    timeoutMs: number,
    startedAt: number,
  ): Promise<TelnetCheckResult> {
    return new Promise((resolve) => {
      let settled = false;
      const socket = new net.Socket();

      const finish = (reachable: boolean, error?: string) => {
        if (settled) return;
        settled = true;
        socket.destroy();

        const result: TelnetCheckResult = {
          host,
          port,
          reachable,
          durationMs: Date.now() - startedAt,
          error,
        };

        if (reachable) {
          console.log(
            '[AisSmsService.telnetCheck] step 2 - connected:',
            result,
          );
        } else {
          console.error(
            '[AisSmsService.telnetCheck] step ERROR - unreachable:',
            result,
          );
        }

        resolve(result);
      };

      socket.setTimeout(timeoutMs);

      socket.once('connect', () => {
        console.log(
          `[AisSmsService.telnetCheck] step 1a - TCP handshake succeeded to ${host}:${port}`,
        );
        finish(true);
      });

      socket.once('timeout', () => {
        console.error(
          `[AisSmsService.telnetCheck] step ERROR - timed out after ${timeoutMs}ms connecting to ${host}:${port}`,
        );
        finish(false, `Timed out after ${timeoutMs}ms`);
      });

      socket.once('error', (error) => {
        console.error(
          '[AisSmsService.telnetCheck] step ERROR - socket error:',
          error,
        );
        finish(false, this.getErrorMessage(error));
      });

      socket.connect(port, host);
    });
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
