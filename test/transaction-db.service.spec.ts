jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));
import { Test, TestingModule } from '@nestjs/testing';
import { TransactionDBService } from '../src/modules/internal/transaction/services/transaction-db.service';
import { TransactionRepository } from '../src/modules/internal/transaction/transaction.repository';
import { startOfDay, endOfDay } from 'date-fns';

describe('TransactionDBService', () => {
  let service: TransactionDBService;
  let repository: TransactionRepository;

  const mockRepo = {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    queryRaw: jest.fn(),
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
        point: true,
        voucherCode: {
          select: {
            id: true,
            currency: true,
            voucher: {
              select: {
                id: true,
                tokenId: true,
                name: true,
                description: true,
                valueType: true,
                value: true,
                currency: true,
                imageUrl: true,
                startDate: true,
                endDate: true,
                merchantRef: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
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
        point: true,
        voucherCode: {
          include: {
            voucher: {
              select: {
                id: true,
                name: true,
                valueType: true,
                value: true,
                imageUrl: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
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

  describe('getAllTransactionsByCustomerId', () => {
    it('should return transactions for customer across all merchants', async () => {
      mockRepo.findMany.mockResolvedValue([mockTransaction]);

      const result = await service.getAllTransactionsByCustomerId('c_1');

      expect(repository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [{ senderId: 'c_1' }, { receiverId: 'c_1' }],
          },
          orderBy: { createdAt: 'desc' },
        }),
      );
      expect(result).toEqual([mockTransaction]);
    });

    it('should return empty array when no transactions', async () => {
      mockRepo.findMany.mockResolvedValue([]);

      const result =
        await service.getAllTransactionsByCustomerId('c_nonexistent');

      expect(result).toEqual([]);
    });
  });

  describe('getTransactionsMonthByMerchantId', () => {
    it('should return transactions with merchant and point included', async () => {
      mockRepo.findMany.mockResolvedValue([mockTransaction]);

      const result = await service.getTransactionsMonthByMerchantId('m_1');

      expect(repository.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            merchantId: 'm_1',
          }),
          include: {
            merchant: true,
            point: true,
          },
        }),
      );
      expect(result).toEqual([mockTransaction]);
    });
  });

  describe('getTransactionById', () => {
    it('should return transaction with relations', async () => {
      const txWithRelations = {
        ...mockTransaction,
        merchant: { id: 'm_1', name: 'Test Merchant' },
        point: { id: 'p_1', name: 'Test Point' },
        voucherCode: null,
      };
      mockRepo.findFirst.mockResolvedValue(txWithRelations);

      const result = await service.getTransactionById('t_1');

      expect(repository.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 't_1' },
          include: expect.objectContaining({
            merchant: true,
            point: true,
          }),
        }),
      );
      expect(result).toEqual(txWithRelations);
    });

    it('should return null when transaction not found', async () => {
      mockRepo.findFirst.mockResolvedValue(null);

      const result = await service.getTransactionById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getTransactionsByMerchantRef', () => {
    const rawRow = {
      id: 't_1',
      txHash: '0xabc',
      senderAddress: '0x111',
      receiverAddress: '0x222',
      transactionTypeId: 'MINT',
      amount: '100',
      senderId: 'c_1',
      receiverId: 'c_2',
      senderType: 'CUSTOMER',
      receiverType: 'CUSTOMER',
      merchantId: 'm_1',
      pointId: 'p_1',
      voucherCodeId: null,
      eventId: null,
      transactionRefId: null,
      type: 'POINT',
      merchantRef: 'ref-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      merchant_id: 'm_1',
      merchant_name: 'Test Merchant',
      merchant_imageUrl: null,
      point_id: 'p_1',
      point_name: 'Test Point',
      point_symbol: 'TST',
      point_imageUrl: null,
      voucherCode_id: null,
      voucher_id: null,
    };

    it('should query raw SQL with merchantRef', async () => {
      mockRepo.queryRaw.mockResolvedValue([rawRow]);

      const result = await service.getTransactionsByMerchantRef('ref-1');

      expect(repository.queryRaw).toHaveBeenCalledWith(
        expect.stringContaining('merchantRef'),
        ['ref-1'],
      );
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('t_1');
      expect(result[0].merchant.id).toBe('m_1');
      expect(result[0].point.id).toBe('p_1');
    });

    it('should add status filter when provided', async () => {
      mockRepo.queryRaw.mockResolvedValue([]);

      await service.getTransactionsByMerchantRef('ref-1', 'mint');

      expect(repository.queryRaw).toHaveBeenCalledWith(
        expect.stringContaining('transactionTypeId'),
        ['ref-1', 'MINT'],
      );
    });

    it('should add couponIds filter when provided', async () => {
      mockRepo.queryRaw.mockResolvedValue([]);

      await service.getTransactionsByMerchantRef('ref-1', undefined, [
        'v1',
        'v2',
      ]);

      expect(repository.queryRaw).toHaveBeenCalledWith(
        expect.stringContaining('IN'),
        ['ref-1', 'v1', 'v2'],
      );
    });

    it('should return null voucherCode when no voucher data in row', async () => {
      const rowNoVoucher = { ...rawRow, voucherCode_id: null };
      mockRepo.queryRaw.mockResolvedValue([rowNoVoucher]);

      const result = await service.getTransactionsByMerchantRef('ref-1');

      expect(result[0].voucherCode).toBeNull();
    });

    it('should return null merchant/point when not present in row', async () => {
      const rowNoRelations = {
        ...rawRow,
        merchant_id: null,
        point_id: null,
      };
      mockRepo.queryRaw.mockResolvedValue([rowNoRelations]);

      const result = await service.getTransactionsByMerchantRef('ref-1');

      expect(result[0].merchant).toBeNull();
      expect(result[0].point).toBeNull();
    });
  });
});
