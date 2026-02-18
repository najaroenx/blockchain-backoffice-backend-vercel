jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));
import { InternalServerErrorException } from '@nestjs/common';
import { CreateSession } from 'src/modules/internal/session/handlers/createSession.handler';
import { SessionDBService } from 'src/modules/internal/session/services/session-db.service';

describe('CreateSession', () => {
  let handler: CreateSession;
  let dbService: jest.Mocked<SessionDBService>;

  beforeEach(() => {
    dbService = {
      createSession: jest.fn(),
      getSessionByToken: jest.fn(),
    } as any;

    handler = new CreateSession(dbService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should create a session successfully', async () => {
    const token = 'jwt-token-123';
    const userId = 'user-1';
    const mockSession = {
      id: 'session-1',
      token,
      userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    dbService.createSession.mockResolvedValue(mockSession as any);

    const result = await handler.execute(token, userId);

    expect(dbService.createSession).toHaveBeenCalledWith(token, userId);
    expect(result).toEqual(mockSession);
  });

  it('should throw InternalServerErrorException on DB error', async () => {
    dbService.createSession.mockRejectedValue(
      new Error('DB connection failed'),
    );

    await expect(handler.execute('token', 'user-1')).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
