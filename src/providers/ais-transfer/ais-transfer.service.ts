import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdmdService } from '../admd/admd.service';
import { PrismaService } from 'prisma/prisma.service';
import {
  AisTransferInParams,
  AisTransferReverseParams,
  AisTransferRequestBody,
  AisTransferReverseRequestBody,
  AisTransferResponse,
} from './types';
import { randomUUID } from 'node:crypto';

const AIS_TRANSFER_POINTS_PATH = '/nlp-px/legacy-api/v1/points';
const AIS_TRANSFER_ENDPOINTS = {
  transferIn: '/transfer-in',
  transferReverse: '/transfer-in/reverse',
} as const;

@Injectable()
export class AisTransferService {
  private readonly logger = new Logger(AisTransferService.name);
  private readonly baseUrl: string;
  private readonly username: string;
  private readonly password: string;
  private readonly referenceCode: string;

  constructor(
    private readonly admdService: AdmdService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.baseUrl = this.buildAisBaseUrl(
      this.configService.get<string>('AIS_TRANSFER_BASE_URL') ?? '',
    );
    this.username = this.configService.get<string>('AIS_TRANSFER_USERNAME');
    this.password = this.configService.get<string>('AIS_TRANSFER_PASSWORD');
    this.referenceCode = this.configService.get<string>(
      'AIS_TRANSFER_REFERENCE_CODE',
    );
  }

  /**
   * Transfer AIS points into a customer's account.
   * POST {domain}/nlp-px/legacy-api/v1/points/transfer-in
   */
  async transferIn(params: AisTransferInParams): Promise<AisTransferResponse> {
    const {
      transactionID,
      msisdn,
      points,
      sessionID = `session_${randomUUID()}`,
      ipAddress = '0.0.0.0',
    } = params;

    this.logger.log(
      `[TRANSFER-IN] transactionID=${transactionID}, msisdn=${msisdn}, points=${points}`,
    );

    const body: AisTransferRequestBody = {
      transactionID,
      username: this.username,
      password: this.password,
      ipAddress,
      msisdn,
      sessionID,
      referenceCode: this.referenceCode,
      points: String(points),
      partnerCardNo: msisdn,
    };

    try {
      const accessToken = await this.admdService.getAccessToken();
      const url = this.buildAisUrl(AIS_TRANSFER_ENDPOINTS.transferIn);

      this.logger.log(`[TRANSFER-IN] Calling AIS API: ${url}`);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
      });

      const responseData = await response.json().catch(() => ({}));
      const success = this.isAisSuccess(responseData);
      const errorMessage = success
        ? null
        : this.buildAisErrorMessage(
            response.status,
            response.statusText,
            responseData,
          );

      // Log to database (non-blocking)
      await this.logTransfer({
        transactionID,
        action: 'TRANSFER_IN',
        url,
        requestBody: body,
        responseBody: responseData,
        httpStatus: response.status,
        success,
        errorMessage,
        msisdn,
        points,
      });

      if (response.status === 401) {
        this.logger.error(
          `[TRANSFER-IN] AIS API unauthorized: ${response.status} ${response.statusText}`,
          JSON.stringify(responseData),
        );

        this.logger.warn(
          '[TRANSFER-IN] Token expired, retrying with new token',
        );
        this.admdService.clearCache();
        return this.transferIn(params);
      }

      if (!success) {
        this.logger.error(
          `[TRANSFER-IN] AIS business error: ${errorMessage}`,
          JSON.stringify(responseData),
        );

        return {
          success: false,
          transactionID,
          error: errorMessage,
          data: responseData,
        };
      }

      this.logger.log(`[TRANSFER-IN] Success: transactionID=${transactionID}`);

      return {
        success: true,
        transactionID,
        data: responseData,
      };
    } catch (error) {
      const errorMessage = this.getErrorMessage(error);
      const errorStack = this.getErrorStack(error);

      this.logger.error(`[TRANSFER-IN] Error: ${errorMessage}`, errorStack);

      // Log network/unexpected errors
      await this.logTransfer({
        transactionID,
        action: 'TRANSFER_IN',
        url: this.buildAisUrl(AIS_TRANSFER_ENDPOINTS.transferIn),
        requestBody: body,
        responseBody: null,
        httpStatus: null,
        success: false,
        errorMessage,
        msisdn,
        points,
      });

      throw new ServiceUnavailableException(
        `AIS transfer-in failed: ${errorMessage}`,
      );
    }
  }

  /**
   * Reverse a previous transfer-in.
   * POST {domain}/nlp-px/legacy-api/v1/points/transfer-in/reverse
   */
  async transferReverse(
    params: AisTransferReverseParams,
  ): Promise<AisTransferResponse> {
    const {
      transactionID,
      msisdn,
      sessionID = `session_${randomUUID()}`,
      ipAddress = '0.0.0.0',
    } = params;

    this.logger.log(
      `[TRANSFER-REVERSE] transactionID=${transactionID}, msisdn=${msisdn}`,
    );

    const body: AisTransferReverseRequestBody = {
      transactionID,
      username: this.username,
      password: this.password,
      ipAddress,
      msisdn,
      sessionID,
    };

    try {
      const accessToken = await this.admdService.getAccessToken();
      const url = this.buildAisUrl(AIS_TRANSFER_ENDPOINTS.transferReverse);

      this.logger.log(`[TRANSFER-REVERSE] Calling AIS API: ${url}`);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
      });

      const responseData = await response.json().catch(() => ({}));
      const success = this.isAisSuccess(responseData);
      const errorMessage = success
        ? null
        : this.buildAisErrorMessage(
            response.status,
            response.statusText,
            responseData,
          );

      // Log to database (non-blocking)
      await this.logTransfer({
        transactionID,
        action: 'TRANSFER_REVERSE',
        url,
        requestBody: body,
        responseBody: responseData,
        httpStatus: response.status,
        success,
        errorMessage,
        msisdn,
        points: null,
      });

      if (response.status === 401) {
        this.logger.error(
          `[TRANSFER-REVERSE] AIS API unauthorized: ${response.status} ${response.statusText}`,
          JSON.stringify(responseData),
        );

        this.logger.warn(
          '[TRANSFER-REVERSE] Token expired, retrying with new token',
        );
        this.admdService.clearCache();
        return this.transferReverse(params);
      }

      if (!success) {
        this.logger.error(
          `[TRANSFER-REVERSE] AIS business error: ${errorMessage}`,
          JSON.stringify(responseData),
        );

        return {
          success: false,
          transactionID,
          error: errorMessage,
          data: responseData,
        };
      }

      this.logger.log(
        `[TRANSFER-REVERSE] Success: transactionID=${transactionID}`,
      );

      return {
        success: true,
        transactionID,
        data: responseData,
      };
    } catch (error) {
      const errorMessage = this.getErrorMessage(error);
      const errorStack = this.getErrorStack(error);

      this.logger.error(
        `[TRANSFER-REVERSE] Error: ${errorMessage}`,
        errorStack,
      );

      // Log network/unexpected errors
      await this.logTransfer({
        transactionID,
        action: 'TRANSFER_REVERSE',
        url: this.buildAisUrl(AIS_TRANSFER_ENDPOINTS.transferReverse),
        requestBody: body,
        responseBody: null,
        httpStatus: null,
        success: false,
        errorMessage,
        msisdn,
        points: null,
      });

      throw new ServiceUnavailableException(
        `AIS transfer reverse failed: ${errorMessage}`,
      );
    }
  }

  private isAisSuccess(responseData: unknown): boolean {
    return this.getAisStatus(responseData) === '20000';
  }

  private buildAisBaseUrl(baseUrl: string): string {
    const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');

    if (normalizedBaseUrl.endsWith(AIS_TRANSFER_POINTS_PATH)) {
      return normalizedBaseUrl;
    }

    return this.joinUrl(normalizedBaseUrl, AIS_TRANSFER_POINTS_PATH);
  }

  private buildAisUrl(endpointPath: string): string {
    return this.joinUrl(this.baseUrl, endpointPath);
  }

  private joinUrl(baseUrl: string, path: string): string {
    const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
    const normalizedPath = path.replace(/^\/+/, '');

    return `${normalizedBaseUrl}/${normalizedPath}`;
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }

  private getErrorStack(error: unknown): string | undefined {
    if (error instanceof Error) {
      return error.stack;
    }

    return undefined;
  }

  private getAisStatus(responseData: unknown): string | null {
    if (!responseData || typeof responseData !== 'object') {
      return null;
    }

    const maybeStatus = (responseData as { status?: unknown }).status;

    if (maybeStatus === undefined || maybeStatus === null) {
      return null;
    }

    return String(maybeStatus);
  }

  private getAisMessage(responseData: unknown): string | null {
    if (!responseData || typeof responseData !== 'object') {
      return null;
    }

    const messageSources = [
      (responseData as { message?: unknown }).message,
      (responseData as { description?: unknown }).description,
      (responseData as { msg?: unknown }).msg,
      (responseData as { errorMessage?: unknown }).errorMessage,
      (responseData as { error?: unknown }).error,
    ];

    for (const candidate of messageSources) {
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        return candidate;
      }
    }

    return null;
  }

  private buildAisErrorMessage(
    httpStatus: number,
    httpStatusText: string,
    responseData: unknown,
  ): string {
    const aisStatus = this.getAisStatus(responseData);
    const aisMessage = this.getAisMessage(responseData);
    const parts = [`HTTP ${httpStatus} ${httpStatusText}`.trim()];

    if (aisStatus) {
      parts.push(`AIS status=${aisStatus}`);
    } else {
      parts.push('AIS status missing');
    }

    if (aisMessage) {
      parts.push(`message=${aisMessage}`);
    }

    return `AIS API error: ${parts.join(', ')}`;
  }

  /**
   * Log AIS transfer API call to database.
   * Request/response bodies are stored as Bytes (blob) for flexibility.
   * Wrapped in try-catch so log failure never blocks the main flow.
   */
  private async logTransfer(params: {
    transactionID: string;
    action: string;
    url: string;
    requestBody: Record<string, any>;
    responseBody: Record<string, any> | null;
    httpStatus: number | null;
    success: boolean;
    errorMessage: string | null;
    msisdn: string;
    points: number | null;
  }): Promise<void> {
    try {
      await this.prisma.aisTransferLog.create({
        data: {
          transactionID: params.transactionID,
          action: params.action,
          url: params.url,
          requestBody: Buffer.from(JSON.stringify(params.requestBody)),
          responseBody: params.responseBody
            ? Buffer.from(JSON.stringify(params.responseBody))
            : null,
          httpStatus: params.httpStatus,
          success: params.success,
          errorMessage: params.errorMessage,
          msisdn: params.msisdn,
          points: params.points,
        },
      });
      this.logger.log(
        `[LOG] AIS transfer logged: action=${params.action}, txn=${params.transactionID}`,
      );
    } catch (logError) {
      const errorMessage = this.getErrorMessage(logError);
      const errorStack = this.getErrorStack(logError);

      // Never let log failure break the main flow
      this.logger.error(
        `[LOG] Failed to log AIS transfer: ${errorMessage}`,
        errorStack,
      );
    }
  }
}
