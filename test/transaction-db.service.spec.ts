import { Test, TestingModule } from '@nestjs/testing';
import { TransactionDBService } from '../src/modules/transaction/services/transaction-db.service';
import { TransactionRepository } from '../src/modules/transaction/transaction.repository';
import { startOfDay, endOfDay } from 'date-fns';

describe('TransactionDBService', () => {
  let service: TransactionDBService;
  let repository: TransactionRepository;

  const mockRepo = {
    findMany: jest.fn(),
    create: jest.fn(),
  };

  const mockTransaction = {
    id: 't_1',
    merchantId: 'm_1',
    senderId: 'c_1',
    receiverId: 'c_2',
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionDBService,
        {
          provide: TransactionRepository,
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<TransactionDBService>(TransactionDBService);
    repository = module.get<TransactionRepository>(TransactionRepository);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('getTransactionsByCustomerId should call repository.findMany correctly', async () => {
    mockRepo.findMany.mockResolvedValue([mockTransaction]);

    const result = await service.getTransactionsByCustomerId('c_1', 'm_1');

    expect(repository.findMany).toHaveBeenCalledWith({
      where: {
        OR: [{ senderId: 'c_1' }, { receiverId: 'c_1' }],
        merchantId: 'm_1',
      },
      include: {
        merchant: true,
        sender: true,
        receiver: true,
        point: true,
      },
    });
    expect(result).toEqual([mockTransaction]);
  });

  it('getTransactionsByMerchantId should call repository.findMany', async () => {
    mockRepo.findMany.mockResolvedValue([mockTransaction]);

    const result = await service.getTransactionsByMerchantId('m_1');
    expect(repository.findMany).toHaveBeenCalledWith({
      where: { merchantId: 'm_1' },
      include: {
        merchant: true,
        sender: true,
        receiver: true,
        point: true,
      },
    });
    expect(result).toEqual([mockTransaction]);
  });

  it('getTransactionsTodayByMerchantId should filter by today', async () => {
    mockRepo.findMany.mockResolvedValue([mockTransaction]);
    const now = new Date();

    await service.getTransactionsTodayByMerchantId('m_1');

    expect(repository.findMany).toHaveBeenCalledWith({
      where: {
        merchantId: 'm_1',
        createdAt: {
          gte: startOfDay(now),
          lte: endOfDay(now),
        },
      },
    });
  });

  it('getTransactionsTodayByMerchantIdAndTypeId should filter by merchant + type', async () => {
    mockRepo.findMany.mockResolvedValue([mockTransaction]);
    const now = new Date();

    await service.getTransactionsTodayByMerchantIdAndTypeId('m_1', 'type_1');

    expect(repository.findMany).toHaveBeenCalledWith({
      where: {
        merchantId: 'm_1',
        transactionTypeId: 'type_1',
        createdAt: {
          gte: startOfDay(now),
          lte: endOfDay(now),
        },
      },
      include: {
        merchant: true,
        sender: true,
        receiver: true,
        point: true,
      },
    });
  });

  it('createTransaction should call repository.create', async () => {
    mockRepo.create.mockResolvedValue(mockTransaction);

    const result = await service.createTransaction({} as any);

    expect(repository.create).toHaveBeenCalledWith({ data: {} });
    expect(result).toEqual(mockTransaction);
  });
});
