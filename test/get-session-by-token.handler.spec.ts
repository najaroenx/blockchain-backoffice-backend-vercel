jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));
import {
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { GetSessionByToken } from 'src/modules/internal/session/handlers/getSessionByToken.handler';
import { SessionDBService } from 'src/modules/internal/session/services/session-db.service';

describe('GetSessionByToken', () => {
  let handler: GetSessionByToken;
  let dbService: jest.Mocked<SessionDBService>;

  const mockSession = {
    id: 'session-1',
    token: 'jwt-token-123',
    userId: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    user: {
      id: 'user-1',
      email: 'test@example.com',
      password: 'hashed',
      walletId: 'wallet-1',
      nextDerivationIndex: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  beforeEach(() => {
    dbService = {
      createSession: jest.fn(),
      getSessionByToken: jest.fn(),
    } as any;

    handler = new GetSessionByToken(dbService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should return session with user when found', async () => {
    dbService.getSessionByToken.mockResolvedValue(mockSession as any);

    const result = await handler.execute('jwt-token-123');

    expect(dbService.getSessionByToken).toHaveBeenCalledWith('jwt-token-123');
    expect(result).toEqual(mockSession);
  });

  it('should throw NotFoundException when session not found', async () => {
    dbService.getSessionByToken.mockResolvedValue(null as any);

    await expect(handler.execute('invalid-token')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should throw InternalServerErrorException on DB error', async () => {
    dbService.getSessionByToken.mockRejectedValue(
      new Error('DB connection failed'),
    );

    await expect(handler.execute('token')).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
