jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import { PrismaRepository } from 'src/repository/PrismaRepository';

describe('PrismaRepository', () => {
  let repo: PrismaRepository<'merchant'>;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      merchant: {
        aggregate: jest.fn().mockResolvedValue({ _count: 5 }),
        count: jest.fn().mockResolvedValue(10),
        create: jest.fn().mockResolvedValue({ id: '1', name: 'Test' }),
        createMany: jest.fn().mockResolvedValue({ count: 3 }),
        delete: jest.fn().mockResolvedValue({ id: '1' }),
        deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
        findFirst: jest.fn().mockResolvedValue({ id: '1' }),
        findFirstOrThrow: jest.fn().mockResolvedValue({ id: '1' }),
        findMany: jest.fn().mockResolvedValue([{ id: '1' }, { id: '2' }]),
        findUnique: jest.fn().mockResolvedValue({ id: '1' }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: '1' }),
        update: jest.fn().mockResolvedValue({ id: '1', name: 'Updated' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        upsert: jest.fn().mockResolvedValue({ id: '1' }),
      },
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ id: '1' }]),
    };
    repo = new PrismaRepository(mockPrisma, 'merchant');
  });

  it('should call aggregate', async () => {
    const result = await repo.aggregate({} as any);
    expect(result).toEqual({ _count: 5 });
    expect(mockPrisma.merchant.aggregate).toHaveBeenCalled();
  });

  it('should call count', async () => {
    const result = await repo.count({} as any);
    expect(result).toBe(10);
  });

  it('should call create', async () => {
    const result = await repo.create({ data: { name: 'Test' } } as any);
    expect(result).toEqual({ id: '1', name: 'Test' });
  });

  it('should call createMany', async () => {
    const result = await repo.createMany({ data: [{ name: 'A' }] } as any);
    expect(result).toEqual({ count: 3 });
  });

  it('should call delete', async () => {
    const result = await repo.delete({ where: { id: '1' } } as any);
    expect(result).toEqual({ id: '1' });
  });

  it('should call deleteMany', async () => {
    const result = await repo.deleteMany({} as any);
    expect(result).toEqual({ count: 2 });
  });

  it('should call findFirst', async () => {
    const result = await repo.findFirst({} as any);
    expect(result).toEqual({ id: '1' });
  });

  it('should call findFirstOrThrow', async () => {
    const result = await repo.findFirstOrThrow({} as any);
    expect(result).toEqual({ id: '1' });
  });

  it('should call findMany', async () => {
    const result = await repo.findMany({} as any);
    expect(result).toEqual([{ id: '1' }, { id: '2' }]);
  });

  it('should call findUnique', async () => {
    const result = await repo.findUnique({ where: { id: '1' } } as any);
    expect(result).toEqual({ id: '1' });
  });

  it('should call findUniqueOrThrow', async () => {
    const result = await repo.findUniqueOrThrow({ where: { id: '1' } } as any);
    expect(result).toEqual({ id: '1' });
  });

  it('should call update', async () => {
    const result = await repo.update({
      where: { id: '1' },
      data: { name: 'Updated' },
    } as any);
    expect(result).toEqual({ id: '1', name: 'Updated' });
  });

  it('should call updateMany', async () => {
    const result = await repo.updateMany({ where: {}, data: {} } as any);
    expect(result).toEqual({ count: 1 });
  });

  it('should call upsert', async () => {
    const result = await repo.upsert({
      where: { id: '1' },
      create: {},
      update: {},
    } as any);
    expect(result).toEqual({ id: '1' });
  });

  it('should call queryRaw', async () => {
    const result = await repo.queryRaw('SELECT * FROM "Merchant"', ['param1']);
    expect(result).toEqual([{ id: '1' }]);
    expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
      'SELECT * FROM "Merchant"',
      'param1',
    );
  });
});
