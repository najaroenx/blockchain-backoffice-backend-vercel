import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';

@Injectable()
export class AdminOnlyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
    }>();
    const response = context.switchToHttp().getResponse<{
      setHeader(name: string, value: string): void;
    }>();

    const adminUsername = this.getConfiguredAdminUsername();
    const adminPassword = this.configService
      .get<string>('ADMIN_PASSWORD')
      ?.trim();

    if (!adminUsername || !adminPassword) {
      this.setAuthChallenge(response);
      throw new UnauthorizedException('Admin basic auth is not configured');
    }

    const credentials = this.parseBasicCredentials(
      request.headers.authorization,
    );

    if (!credentials) {
      this.setAuthChallenge(response);
      throw new UnauthorizedException('Invalid admin credentials');
    }

    const { username, password } = credentials;

    if (
      this.safeEquals(this.normalizeIdentifier(username), adminUsername) &&
      this.safeEquals(password, adminPassword)
    ) {
      return true;
    }

    this.setAuthChallenge(response);
    throw new UnauthorizedException('Invalid admin credentials');
  }

  private parseBasicCredentials(
    authorizationHeader?: string,
  ): { username: string; password: string } | null {
    if (!authorizationHeader?.startsWith('Basic ')) {
      return null;
    }

    const encodedCredentials = authorizationHeader.slice('Basic '.length);
    const decodedCredentials = Buffer.from(
      encodedCredentials,
      'base64',
    ).toString('utf-8');
    const separatorIndex = decodedCredentials.indexOf(':');

    if (separatorIndex <= 0) {
      return null;
    }

    return {
      username: decodedCredentials.slice(0, separatorIndex),
      password: decodedCredentials.slice(separatorIndex + 1),
    };
  }

  private getConfiguredAdminUsername(): string {
    return this.normalizeIdentifier(
      this.configService.get<string>('ADMIN_USERNAME'),
    );
  }

  private normalizeIdentifier(value?: string): string {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
  }

  private safeEquals(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);

    if (leftBuffer.length !== rightBuffer.length) {
      return false;
    }

    return timingSafeEqual(leftBuffer, rightBuffer);
  }

  private setAuthChallenge(response: {
    setHeader(name: string, value: string): void;
  }): void {
    response.setHeader('WWW-Authenticate', 'Basic realm="admin-export"');
  }
}
