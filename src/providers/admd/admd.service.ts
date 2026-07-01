import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdmdTokenResponse } from './types';

@Injectable()
export class AdmdService {
  private readonly logger = new Logger(AdmdService.name);
  private readonly tokenUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;

  private cachedToken: string | null = null;
  private tokenExpiry = 0; // unix timestamp in ms

  constructor(private readonly configService: ConfigService) {
    this.tokenUrl = this.configService.get<string>('ADMD_TOKEN_URL');
    this.clientId = this.configService.get<string>('ADMD_CLIENT_ID');
    this.clientSecret = this.configService.get<string>('ADMD_CLIENT_SECRET');
  }

  /**
   * Get a valid access token from ADMD.
   * Uses in-memory caching — reuses the token until 60s before expiry.
   */
  async getAccessToken(): Promise<string> {
    // Return cached token if still valid (with 60s buffer)
    if (this.cachedToken && Date.now() < this.tokenExpiry - 60_000) {
      this.logger.debug('Using cached ADMD token');
      return this.cachedToken;
    }

    this.logger.log('Requesting new ADMD access token');

    try {
      const body = new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'client_credentials',
      });

      const response = await fetch(this.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        this.logger.error(
          `ADMD token request failed: ${response.status} ${response.statusText}`,
          errorBody,
        );
        throw new ServiceUnavailableException(
          'Failed to obtain ADMD access token',
        );
      }

      const data: AdmdTokenResponse = await response.json();

      this.cachedToken = data.access_token;
      // expires_in is in seconds — convert to ms and add to current time
      this.tokenExpiry = Date.now() + data.expires_in * 1000;

      this.logger.log(
        `ADMD token obtained successfully (expires in ${data.expires_in}s)`,
      );

      return this.cachedToken;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      this.logger.error(
        `Error requesting ADMD token: ${error.message}`,
        error.stack,
      );
      throw new ServiceUnavailableException(
        'Failed to obtain ADMD access token',
      );
    }
  }

  /**
   * Clear the cached token (useful for retry logic).
   */
  clearCache(): void {
    this.cachedToken = null;
    this.tokenExpiry = 0;
  }
}
