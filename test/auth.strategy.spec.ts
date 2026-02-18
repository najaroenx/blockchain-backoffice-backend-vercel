jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import { AuthStrategy } from 'src/modules/internal/auth/auth.strategy';
import { TokenService } from 'src/providers/token/token.service';
import { GetApiKey } from 'src/modules/internal/api-key/handlers/getApiKey.handler';

describe('AuthStrategy', () => {
  let strategy: AuthStrategy;
  let tokenService: any;
  let getApiKey: any;

  beforeEach(() => {
    tokenService = {
      verify: jest.fn(),
    };
    getApiKey = {
      execute: jest.fn(),
    };
    strategy = new AuthStrategy(
      tokenService as unknown as TokenService,
      getApiKey as unknown as GetApiKey,
    );
  });

  const mockSuccess = jest.fn();
  const mockFail = jest.fn();

  beforeEach(() => {
    (strategy as any).success = mockSuccess;
    (strategy as any).fail = mockFail;
    mockSuccess.mockReset();
    mockFail.mockReset();
  });

  it('should authenticate with API key from x-api-key header', async () => {
    getApiKey.execute.mockResolvedValue({ id: 'key1' });

    const req = {
      query: {},
      headers: { 'x-api-key': 'non-jwt-key' },
      params: { merchantId: 'm1' },
    } as any;

    await strategy.authenticate(req);

    expect(getApiKey.execute).toHaveBeenCalledWith('non-jwt-key', 'm1');
    expect(mockSuccess).toHaveBeenCalledWith({ type: 'api-key', id: 'key1' });
  });

  it('should authenticate with API key from query param', async () => {
    getApiKey.execute.mockResolvedValue({ id: 'key2' });

    const req = {
      query: { api_key: 'simple-api-key' },
      headers: {},
      params: {},
    } as any;

    await strategy.authenticate(req);

    expect(mockSuccess).toHaveBeenCalledWith({ type: 'api-key', id: 'key2' });
  });

  it('should authenticate with JWT from Authorization header', async () => {
    tokenService.verify.mockReturnValue({ id: 'user1', type: 'jwt' });

    // JWT format: xxx.yyy.zzz
    const req = {
      query: {},
      headers: {
        authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjEifQ.sig123',
      },
      params: {},
    } as any;

    await strategy.authenticate(req);

    expect(tokenService.verify).toHaveBeenCalled();
    expect(mockSuccess).toHaveBeenCalledWith({ id: 'user1', type: 'jwt' });
  });

  it('should fail when no token or authorization provided', async () => {
    const req = {
      query: {},
      headers: {},
      params: {},
    } as any;

    await strategy.authenticate(req);

    expect(mockFail).toHaveBeenCalledWith('Invalid request', 400);
  });

  it('should fail when JWT is invalid', async () => {
    tokenService.verify.mockImplementation(() => {
      throw new Error('invalid');
    });

    const req = {
      query: {},
      headers: { authorization: 'Bearer eyJ.eyJ.sig' },
      params: {},
    } as any;

    await strategy.authenticate(req);

    expect(mockFail).toHaveBeenCalledWith('Invalid token', 400);
  });

  it('should fallback to JWT when API key validation fails', async () => {
    getApiKey.execute.mockRejectedValue(new Error('invalid'));
    tokenService.verify.mockReturnValue({ id: 'user1' });

    const req = {
      query: { token: 'eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjEifQ.sig' },
      headers: { authorization: 'plain-key' },
      params: {},
    } as any;

    await strategy.authenticate(req);

    // API key fails silently, then tries JWT from query.token
    expect(tokenService.verify).toHaveBeenCalled();
    expect(mockSuccess).toHaveBeenCalledWith({ id: 'user1' });
  });

  it('should strip Bearer prefix from authorization header for API key', async () => {
    getApiKey.execute.mockResolvedValue({ id: 'key3' });

    const req = {
      query: {},
      headers: { authorization: 'Bearer my-api-key' },
      params: { merchantId: 'm1' },
    } as any;

    await strategy.authenticate(req);

    expect(getApiKey.execute).toHaveBeenCalledWith('my-api-key', 'm1');
  });
});
