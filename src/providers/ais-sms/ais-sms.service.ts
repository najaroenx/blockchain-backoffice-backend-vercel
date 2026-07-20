import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AisSmsContentType,
  AisSmsDeliveryReport,
  AisSmsSendParams,
  AisSmsSendResult,
} from './types';

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
  }

  /**
   * Send an SMS via the AIS MT (Mobile Terminate) endpoint.
   * POST {apiUrl} CMD=SENDMSG&FROM=..&TO=..&REPORT=..&CHARGE=..&CODE=..&CTYPE=..&CONTENT=..
   */
  async sendMt(params: AisSmsSendParams): Promise<AisSmsSendResult> {
    const { to, content } = params;
    const ctype = params.ctype ?? this.detectContentType(content);
    const report = params.report === false ? 'N' : 'Y';
    const maskedTo = this.maskPhone(to);

    this.logger.log(`[MT] Sending SMS to ${maskedTo}, ctype=${ctype}`);

    const body = this.buildRequestBody({ to, content, ctype, report });

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      });

      const rawText = await response.text();

      if (!response.ok) {
        this.logger.error(
          `[MT] AIS gateway HTTP error: ${response.status} ${response.statusText}`,
          rawText,
        );
        throw new Error(
          `AIS gateway HTTP error: ${response.status} ${response.statusText}`,
        );
      }

      const result = this.parseSendResponse(rawText);

      if (result.success) {
        this.logger.log(
          `[MT] SMS sent to ${maskedTo}, smid=${result.smid}`,
        );
      } else {
        this.logger.error(
          `[MT] AIS gateway rejected message to ${maskedTo}: ${result.detail}`,
        );
      }

      return result;
    } catch (error) {
      const message = this.getErrorMessage(error);
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
  parseDeliveryReport(
    payload: Record<string, string>,
  ): AisSmsDeliveryReport {
    return {
      ntype: payload.NTYPE,
      from: payload.FROM,
      smid: payload.SMID,
      status: payload.STATUS === 'OK' ? 'OK' : 'ERR',
      detail: payload.DETAIL,
    };
  }

  /**
   * XML acknowledgement body AIS expects back after posting a Delivery Report.
   */
  buildDeliveryReportAckXml(): string {
    return '<XML><STATUS>OK</STATUS><DETAIL></DETAIL></XML>';
  }

  private detectContentType(content: string): AisSmsContentType {
    // eslint-disable-next-line no-control-regex
    return /[^\x00-\x7F]/.test(content) ? 'UNICODE' : 'TEXT';
  }

  private buildRequestBody(params: {
    to: string;
    content: string;
    ctype: AisSmsContentType;
    report: 'Y' | 'N';
  }): string {
    const { to, content, ctype, report } = params;

    const encodedContent =
      ctype === 'UNICODE'
        ? this.encodeUnicodeContent(content)
        : encodeURIComponent(content);

    return [
      'CMD=SENDMSG',
      `FROM=${encodeURIComponent(this.from)}`,
      `TO=${encodeURIComponent(to)}`,
      `REPORT=${report}`,
      `CHARGE=${encodeURIComponent(this.charge)}`,
      `CODE=${encodeURIComponent(this.code)}`,
      `CTYPE=${ctype}`,
      `CONTENT=${encodedContent}`,
    ].join('&');
  }

  /**
   * Thai (UNICODE) content must be sent as percent-encoded UTF-16BE bytes,
   * e.g. "AIS" -> %00%41%00%49%00%53 (spec §1.a example).
   * Buffer.from(.., 'utf16le') gives little-endian pairs; swap16() flips each
   * pair to big-endian, matching the spec's UTF-16BE requirement exactly.
   */
  private encodeUnicodeContent(content: string): string {
    const utf16be = Buffer.from(content, 'utf16le').swap16();
    let encoded = '';
    for (const byte of utf16be) {
      encoded += `%${byte.toString(16).toUpperCase().padStart(2, '0')}`;
    }
    return encoded;
  }

  private parseSendResponse(xml: string): AisSmsSendResult {
    const status = this.extractXmlTag(xml, 'STATUS') ?? 'ERR';
    const detail = this.extractXmlTag(xml, 'DETAIL') ?? '';
    const smid = this.extractXmlTag(xml, 'SMID') || null;

    return {
      success: status === 'OK',
      status,
      detail,
      smid,
      raw: xml,
    };
  }

  private extractXmlTag(xml: string, tag: string): string | null {
    const match = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`, 'i'));
    return match ? match[1].trim() : null;
  }

  private maskPhone(phoneNumber: string): string {
    return phoneNumber.replace(/(\d{3})\d+(\d{2})/, '$1***$2');
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private getErrorStack(error: unknown): string | undefined {
    return error instanceof Error ? error.stack : undefined;
  }
}
