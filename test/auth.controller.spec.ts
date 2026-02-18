jest.mock('prisma/prisma.service', () => ({ PrismaService: jest.fn() }));

import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from 'src/modules/internal/auth/controllers/auth.controller';
import { AuthService } from 'src/modules/internal/auth/services/auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  beforeEach(async () => {
    authService = {
      login: jest.fn(),
      register: jest.fn(),
      refresh: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('login delegates to authService', async () => {
    authService.login.mockResolvedValue({ token: 'tok' } as any);
    const result = await controller.login({
      email: 'a@b.com',
      password: 'pass',
    });
    expect(authService.login).toHaveBeenCalledWith('a@b.com', 'pass');
    expect(result).toEqual({ token: 'tok' });
  });

  it('toverify returns verify object', async () => {
    const result = await controller.toverify('m1');
    expect(result).toHaveProperty('message');
    expect(result).toHaveProperty('url');
    expect(result).toHaveProperty('callbackUrl');
  });

  it('register delegates to authService', async () => {
    authService.register.mockResolvedValue({ id: 'u1' } as any);
    const result = await controller.register({
      email: 'a@b.com',
      password: 'pass',
    });
    expect(authService.register).toHaveBeenCalledWith({
      email: 'a@b.com',
      password: 'pass',
    });
    expect(result).toEqual({ id: 'u1' });
  });

  it('refresh delegates to authService', async () => {
    authService.refresh.mockResolvedValue({ token: 'new' } as any);
    const result = await controller.refresh('old-token');
    expect(authService.refresh).toHaveBeenCalledWith('old-token');
    expect(result).toEqual({ token: 'new' });
  });
});
