import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminOnlyGuard } from '../src/modules/internal/admin/guards/admin-only.guard';

describe('AdminOnlyGuard', () => {
  let guard: AdminOnlyGuard;
  let configService: jest.Mocked<ConfigService>;
  let response: { setHeader: jest.Mock };

  const createContext = (authorization?: string) => {
    const request = {
      headers: { authorization },
      adminActor: undefined as string | undefined,
    };
    const context = {
      switchToHttp: jest.fn(() => ({
        getRequest: jest.fn(() => request),
        getResponse: jest.fn(() => response),
      })),
    } as any;

    return { context: context as ExecutionContext, request };
  };

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

    const { context, request } = createContext(
      'Basic YWRtaW46c3VwZXItc2VjcmV0',
    );

    expect(guard.canActivate(context)).toBe(true);
    expect(request.adminActor).toBe('admin');
  });

  it('treats configured admin username as case-insensitive', () => {
    configService.get.mockImplementation((key: string) => {
      if (key === 'ADMIN_USERNAME') return 'admin';
      if (key === 'ADMIN_PASSWORD') return 'super-secret';
      return undefined;
    });

    const { context, request } = createContext(
      'Basic QWRtaW46c3VwZXItc2VjcmV0',
    );

    expect(guard.canActivate(context)).toBe(true);
    expect(request.adminActor).toBe('admin');
  });

  it('rejects requests without basic auth header', () => {
    configService.get.mockImplementation((key: string) => {
      if (key === 'ADMIN_USERNAME') return 'admin';
      if (key === 'ADMIN_PASSWORD') return 'super-secret';
      return undefined;
    });

    expect(() => guard.canActivate(createContext().context)).toThrow(
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
      guard.canActivate(
        createContext('Basic YWRtaW46d3JvbmctcGFzcw==').context,
      ),
    ).toThrow(new UnauthorizedException('Invalid admin credentials'));
  });

  it('rejects invalid authorization scheme', () => {
    configService.get.mockImplementation((key: string) => {
      if (key === 'ADMIN_USERNAME') return 'admin';
      if (key === 'ADMIN_PASSWORD') return 'super-secret';
      return undefined;
    });

    expect(() =>
      guard.canActivate(createContext('Bearer some-token').context),
    ).toThrow(new UnauthorizedException('Invalid admin credentials'));
  });

  it('rejects access when admin basic auth config is missing', () => {
    configService.get.mockImplementation((key: string) => {
      if (key === 'ADMIN_USERNAME') return '';
      if (key === 'ADMIN_PASSWORD') return '';
      return undefined;
    });

    expect(() =>
      guard.canActivate(
        createContext('Basic YWRtaW5AZXhhbXBsZS5jb206c3VwZXItc2VjcmV0').context,
      ),
    ).toThrow(new UnauthorizedException('Admin basic auth is not configured'));
  });
});
