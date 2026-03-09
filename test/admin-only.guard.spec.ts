import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminOnlyGuard } from '../src/modules/internal/admin/guards/admin-only.guard';

describe('AdminOnlyGuard', () => {
  let guard: AdminOnlyGuard;
  let configService: jest.Mocked<ConfigService>;
  let response: { setHeader: jest.Mock };

  const createContext = (authorization?: string): ExecutionContext =>
    ({
      switchToHttp: jest.fn(() => ({
        getRequest: jest.fn(() => ({
          headers: { authorization },
        })),
        getResponse: jest.fn(() => response),
      })),
    }) as any;

  beforeEach(() => {
    configService = {
      get: jest.fn(),
    } as any;
    response = {
      setHeader: jest.fn(),
    };

    guard = new AdminOnlyGuard(configService);
  });

  it('allows valid basic auth credentials from config', () => {
    configService.get.mockImplementation((key: string) => {
      if (key === 'ADMIN_USERNAME') return 'admin';
      if (key === 'ADMIN_PASSWORD') return 'super-secret';
      return undefined;
    });

    expect(
      guard.canActivate(createContext('Basic YWRtaW46c3VwZXItc2VjcmV0')),
    ).toBe(true);
  });

  it('treats configured admin username as case-insensitive', () => {
    configService.get.mockImplementation((key: string) => {
      if (key === 'ADMIN_USERNAME') return 'admin';
      if (key === 'ADMIN_PASSWORD') return 'super-secret';
      return undefined;
    });

    expect(
      guard.canActivate(createContext('Basic QWRtaW46c3VwZXItc2VjcmV0')),
    ).toBe(true);
  });

  it('rejects requests without basic auth header', () => {
    configService.get.mockImplementation((key: string) => {
      if (key === 'ADMIN_USERNAME') return 'admin';
      if (key === 'ADMIN_PASSWORD') return 'super-secret';
      return undefined;
    });

    expect(() => guard.canActivate(createContext())).toThrow(
      new UnauthorizedException('Invalid admin credentials'),
    );
    expect(response.setHeader).toHaveBeenCalledWith(
      'WWW-Authenticate',
      'Basic realm="admin-export"',
    );
  });

  it('rejects invalid basic auth credentials', () => {
    configService.get.mockImplementation((key: string) => {
      if (key === 'ADMIN_USERNAME') return 'admin';
      if (key === 'ADMIN_PASSWORD') return 'super-secret';
      return undefined;
    });

    expect(() =>
      guard.canActivate(createContext('Basic YWRtaW46d3JvbmctcGFzcw==')),
    ).toThrow(new UnauthorizedException('Invalid admin credentials'));
  });

  it('rejects invalid authorization scheme', () => {
    configService.get.mockImplementation((key: string) => {
      if (key === 'ADMIN_USERNAME') return 'admin';
      if (key === 'ADMIN_PASSWORD') return 'super-secret';
      return undefined;
    });

    expect(() => guard.canActivate(createContext('Bearer some-token'))).toThrow(
      new UnauthorizedException('Invalid admin credentials'),
    );
  });

  it('rejects access when admin basic auth config is missing', () => {
    configService.get.mockImplementation((key: string) => {
      if (key === 'ADMIN_USERNAME') return '';
      if (key === 'ADMIN_PASSWORD') return '';
      return undefined;
    });

    expect(() =>
      guard.canActivate(
        createContext('Basic YWRtaW5AZXhhbXBsZS5jb206c3VwZXItc2VjcmV0'),
      ),
    ).toThrow(new UnauthorizedException('Admin basic auth is not configured'));
  });
});
