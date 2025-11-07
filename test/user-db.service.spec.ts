import { Test, TestingModule } from '@nestjs/testing';
import { UserDBService } from '../src/modules/user/services/user-db.service';
import { UserRepository } from '../src/modules/user/user.repository';
import type { User } from '@prisma/client';

describe('UserDBService', () => {
  let service: UserDBService;

  const mockUser: User = {
    id: 'u_1',
    email: 'test@example.com',
    password: 'password123',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const repo = { create: jest.fn(), findFirst: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UserDBService, { provide: UserRepository, useValue: repo }],
    }).compile();

    service = module.get(UserDBService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createUser', () => {
    it('calls repository.create and returns created user', async () => {
      repo.create.mockResolvedValue(mockUser);

      const result = await service.createUser({
        email: mockUser.email,
        password: mockUser.password,
      });

      expect(repo.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ email: mockUser.email }),
      });
      expect(result).toEqual(mockUser);
    });
  });

  describe('getUserByEmail', () => {
    it('returns user when found', async () => {
      repo.findFirst.mockResolvedValue(mockUser);

      const result = await service.getUserByEmail('test@example.com');

      expect(repo.findFirst).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(result).toEqual(mockUser);
    });

    it('returns null when not found', async () => {
      repo.findFirst.mockResolvedValue(null);

      const result = await service.getUserByEmail('none@example.com');

      expect(repo.findFirst).toHaveBeenCalledWith({
        where: { email: 'none@example.com' },
      });
      expect(result).toBeNull();
    });
  });
});
