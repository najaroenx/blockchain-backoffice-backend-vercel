import { PrismaRepository } from '../src/repository/PrismaRepository';
import { mockPrismaService } from './mocks/prisma.mock';

describe('PrismaRepository', () => {
  let repository: PrismaRepository<'user'>;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new PrismaRepository(mockPrismaService as any, 'user');
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  it('should call prisma.user.findMany correctly', async () => {
    mockPrismaService.user.findMany.mockResolvedValue([
      { id: 1, name: 'Alice' },
    ]);

    const result = await repository.findMany();

    expect(mockPrismaService.user.findMany).toHaveBeenCalled();
    expect(result).toEqual([{ id: 1, name: 'Alice' }]);
  });

  it('should create user using create()', async () => {
    mockPrismaService.user.create.mockResolvedValue({ id: 1, name: 'John' });

    const result = await repository.create({
      data: { id: '1', email: 'john@example.com', password: 'secret' },
    });

    expect(mockPrismaService.user.create).toHaveBeenCalledWith({
      data: { id: '1', email: 'john@example.com', password: 'secret' },
    });
    expect(result).toEqual({ id: 1, name: 'John' });
  });

  it('should update user correctly', async () => {
    mockPrismaService.user.update.mockResolvedValue({
      id: 1,
      email: 'updated@example.com',
    });

    const result = await repository.update({
      where: { id: '1' },
      data: { email: 'updated@example.com' },
    });

    expect(mockPrismaService.user.update).toHaveBeenCalled();
    expect(result).toEqual({ id: 1, email: 'updated@example.com' });
  });
});
