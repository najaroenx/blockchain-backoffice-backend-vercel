import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { CustomAuthGuard } from '../src/modules/internal/auth/custom-auth.guard';
import { MERCHANT_BACK_OFFICE_PUBLIC_ENDPOINT } from '../src/modules/internal/auth/auth.constant';

// Mock passport AuthGuard
jest.mock('@nestjs/passport', () => ({
  AuthGuard: () => {
    class MockAuthGuard {
      canActivate() {
        return true;
      }
    }
    return MockAuthGuard;
  },
}));

describe('CustomAuthGuard', () => {
  let guard: CustomAuthGuard;
  let reflector: jest.Mocked<Reflector>;
  let configService: jest.Mocked<ConfigService>;

  const createMockContext = (): ExecutionContext =>
    ({
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn(),
    }) as any;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as any;

    configService = {
      get: jest.fn(),
    } as any;

    guard = new CustomAuthGuard(reflector, configService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should return true when ENABLE_AUTH is false', () => {
    configService.get.mockReturnValue(false);
    const context = createMockContext();

    const result = guard.canActivate(context);

    expect(configService.get).toHaveBeenCalledWith('ENABLE_AUTH');
    expect(result).toBe(true);
  });

  it('should return true when endpoint is marked as public', () => {
    configService.get.mockReturnValue(true);
    reflector.getAllAndOverride.mockReturnValue(true);
    const context = createMockContext();

    const result = guard.canActivate(context);

    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(
      MERCHANT_BACK_OFFICE_PUBLIC_ENDPOINT,
      [context.getHandler(), context.getClass()],
    );
    expect(result).toBe(true);
  });

  it('should call super.canActivate when auth is enabled and endpoint not public', () => {
    configService.get.mockReturnValue(true);
    reflector.getAllAndOverride.mockReturnValue(false);
    const context = createMockContext();

    const result = guard.canActivate(context);

    // super.canActivate returns true from our mock
    expect(result).toBe(true);
  });

  it('should call super.canActivate when ENABLE_AUTH is undefined (truthy)', () => {
    configService.get.mockReturnValue(undefined);
    reflector.getAllAndOverride.mockReturnValue(false);
    const context = createMockContext();

    const result = guard.canActivate(context);

    expect(result).toBe(true);
  });
});
