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
import { randomUUID } from 'crypto';

@Injectable()
export class AisTransferService {
  private logger = new Logger(AisTransferService.name);
  private baseUrl: string;
  private username: string;
  private password: string;
  private referenceCode: string;

  constructor(
    private admdService: AdmdService,
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    this.baseUrl = this.configService.get<string>('AIS_TRANSFER_BASE_URL');
    this.username = this.configService.get<string>('AIS_TRANSFER_USERNAME');
    this.password = this.configService.get<string>('AIS_TRANSFER_PASSWORD');
    this.referenceCode = this.configService.get<string>(
      'AIS_TRANSFER_REFERENCE_CODE',
    );
  }

  /**
   * Transfer AIS points into a customer's account.
   * POST {baseUrl}/transfer-in
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
      const url = `${this.baseUrl}/transfer-in`;

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

      // Log to database (non-blocking)
      await this.logTransfer({
        transactionID,
        action: 'TRANSFER_IN',
        url,
        requestBody: body,
        responseBody: responseData,
        httpStatus: response.status,
        success: response.ok,
        errorMessage: response.ok
          ? null
          : `AIS API error: ${response.status} ${response.statusText}`,
        msisdn,
        points,
      });

      if (!response.ok) {
        this.logger.error(
          `[TRANSFER-IN] AIS API error: ${response.status} ${response.statusText}`,
          JSON.stringify(responseData),
        );

        // If 401, clear ADMD token cache and retry once
        if (response.status === 401) {
          this.logger.warn(
            '[TRANSFER-IN] Token expired, retrying with new token',
          );
          this.admdService.clearCache();
          return this.transferIn(params);
        }

        return {
          success: false,
          transactionID,
          error: `AIS API error: ${response.status} ${response.statusText}`,
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
      this.logger.error(`[TRANSFER-IN] Error: ${error.message}`, error.stack);

      // Log network/unexpected errors
      await this.logTransfer({
        transactionID,
        action: 'TRANSFER_IN',
        url: `${this.baseUrl}/transfer-in`,
        requestBody: body,
        responseBody: null,
        httpStatus: null,
        success: false,
        errorMessage: error.message,
        msisdn,
        points,
      });

      throw new ServiceUnavailableException(
        `AIS transfer-in failed: ${error.message}`,
      );
    }
  }

  /**
   * Reverse a previous transfer-in.
   * POST {baseUrl}/transfer-in/reverse
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
      const url = `${this.baseUrl}/transfer-in/reverse`;

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

      // Log to database (non-blocking)
      await this.logTransfer({
        transactionID,
        action: 'TRANSFER_REVERSE',
        url,
        requestBody: body,
        responseBody: responseData,
        httpStatus: response.status,
        success: response.ok,
        errorMessage: response.ok
          ? null
          : `AIS API error: ${response.status} ${response.statusText}`,
        msisdn,
        points: null,
      });

      if (!response.ok) {
        this.logger.error(
          `[TRANSFER-REVERSE] AIS API error: ${response.status} ${response.statusText}`,
          JSON.stringify(responseData),
        );

        // If 401, clear ADMD token cache and retry once
        if (response.status === 401) {
          this.logger.warn(
            '[TRANSFER-REVERSE] Token expired, retrying with new token',
          );
          this.admdService.clearCache();
          return this.transferReverse(params);
        }

        return {
          success: false,
          transactionID,
          error: `AIS API error: ${response.status} ${response.statusText}`,
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
      this.logger.error(
        `[TRANSFER-REVERSE] Error: ${error.message}`,
        error.stack,
      );

      // Log network/unexpected errors
      await this.logTransfer({
        transactionID,
        action: 'TRANSFER_REVERSE',
        url: `${this.baseUrl}/transfer-in/reverse`,
        requestBody: body,
        responseBody: null,
        httpStatus: null,
        success: false,
        errorMessage: error.message,
        msisdn,
        points: null,
      });

      throw new ServiceUnavailableException(
        `AIS transfer reverse failed: ${error.message}`,
      );
    }
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
      // Never let log failure break the main flow
      this.logger.error(
        `[LOG] Failed to log AIS transfer: ${logError.message}`,
        logError.stack,
      );
    }
  }
}
