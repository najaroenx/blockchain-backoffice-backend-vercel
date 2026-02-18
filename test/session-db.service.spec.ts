jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));
import { Test, TestingModule } from '@nestjs/testing';
import { SessionDBService } from '../src/modules/internal/session/services/session-db.service';
import { SessionRepository } from '../src/modules/internal/session/session.repository';

describe('SessionDBService', () => {
  let service: SessionDBService;

  const repo = {
    create: jest.fn(),
    findFirst: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionDBService,
        { provide: SessionRepository, useValue: repo },
      ],
    }).compile();

    service = module.get(SessionDBService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createSession', () => {
    it('should create a session and return it', async () => {
      const mockSession = {
        id: 'session-1',
        token: 'jwt-token',
        userId: 'user-1',
        createdAt: new Date(),
      };
      repo.create.mockResolvedValue(mockSession);

      const result = await service.createSession('jwt-token', 'user-1');

      expect(repo.create).toHaveBeenCalledWith({
        data: { token: 'jwt-token', userId: 'user-1' },
      });
      expect(result).toEqual(mockSession);
    });
  });

  describe('getSessionByToken', () => {
    it('should return session with user when found', async () => {
      const mockSession = {
        id: 'session-1',
        token: 'jwt-token',
        userId: 'user-1',
        user: { id: 'user-1', email: 'test@example.com' },
      };
      repo.findFirst.mockResolvedValue(mockSession);

      const result = await service.getSessionByToken('jwt-token');

      expect(repo.findFirst).toHaveBeenCalledWith({
        where: { token: 'jwt-token' },
        include: { user: true },
      });
      expect(result).toEqual(mockSession);
    });

    it('should return null when session not found', async () => {
      repo.findFirst.mockResolvedValue(null);

      const result = await service.getSessionByToken('nonexistent');

      expect(result).toBeNull();
    });
  });
});
