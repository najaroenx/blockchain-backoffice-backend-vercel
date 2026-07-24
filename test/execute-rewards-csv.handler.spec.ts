jest.mock('prisma/prisma.service', () => ({ PrismaService: jest.fn() }));

import { BadRequestException } from '@nestjs/common';
import { ExecuteRewardsCsvHandler } from 'src/modules/internal/admin/handlers/execute-rewards-csv.handler';

describe('ExecuteRewardsCsvHandler', () => {
  let handler: ExecuteRewardsCsvHandler;
  let mockPrisma: any;
  let mockTransferHandler: any;

  const makeCsvBuffer = (rows: string[]) => {
    return Buffer.from(rows.join('\n'), 'utf-8');
  };

  beforeEach(() => {
    mockPrisma = {
      customer: { findUnique: jest.fn() },
      voucherCode: { findFirst: jest.fn() },
    };
    mockTransferHandler = {
      execute: jest.fn(),
    };
    handler = new ExecuteRewardsCsvHandler(mockPrisma, mockTransferHandler);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should throw BadRequestException when no file provided', async () => {
    await expect(handler.execute(null)).rejects.toThrow(BadRequestException);
    await expect(handler.execute({})).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException when file exceeds 2MB', async () => {
    const bigBuffer = Buffer.alloc(3 * 1024 * 1024, 'x');
    await expect(handler.execute({ buffer: bigBuffer })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should return empty results when CSV has only header', async () => {
    const buffer = makeCsvBuffer([
      'Seq,MerchantRef,Col3,VoucherName,Col5,Col6,Col7,Col8,Status,Phone,Col11,VoucherId',
    ]);

    const result = await handler.execute({ buffer });

    expect(result.summary.totalRecordsProcessed).toBe(0);
    expect(result.summary.successCount).toBe(0);
  });

  it('should skip rows with status != "ยังไม่ได้แจก"', async () => {
    const buffer = makeCsvBuffer([
      'Seq,MerchantRef,Col3,VoucherName,Col5,Col6,Col7,Col8,Status,Phone,Col11,VoucherId',
      '1,REF1,a,b,c,d,e,f,แจกแล้ว,0812345678,j,VID1',
    ]);

    const result = await handler.execute({ buffer });

    expect(result.summary.successCount).toBe(0);
    expect(result.summary.failedTransferCount).toBe(0);
  });

  it('should add to notFoundCustomers when customer not found', async () => {
    const buffer = makeCsvBuffer([
      'Seq,MerchantRef,Col3,VoucherName,Col5,Col6,Col7,Col8,Status,Phone,Col11,VoucherId',
      '1,REF1,a,b,c,d,e,f,ยังไม่ได้แจก,0812345678,j,VID1',
    ]);
    mockPrisma.customer.findUnique.mockResolvedValue(null);

    const result = await handler.execute({ buffer });

    expect(result.summary.notFoundCustomers).toBe(1);
    expect(result.payload.notFoundCustomers[0].phone).toBe('0812345678');
  });

  it('should add to failedTransfers when no available code found', async () => {
    const buffer = makeCsvBuffer([
      'Seq,MerchantRef,Col3,VoucherName,Col5,Col6,Col7,Col8,Status,Phone,Col11,VoucherId',
      '1,REF1,a,b,c,d,e,f,ยังไม่ได้แจก,0812345678,j,VID1',
    ]);
    mockPrisma.customer.findUnique.mockResolvedValue({
      id: 'c1',
      wallet: { walletAddress: '0xCUST' },
    });
    mockPrisma.voucherCode.findFirst.mockResolvedValue(null);

    const result = await handler.execute({ buffer });

    expect(result.summary.failedTransferCount).toBe(1);
    expect(result.payload.failedTransfers[0].reason).toBe(
      'NO_QUOTA_OR_MERCHANT_NOT_FOUND',
    );
  });

  it('should execute transfer and add to successTransfers', async () => {
    const buffer = makeCsvBuffer([
      'Seq,MerchantRef,Col3,VoucherName,Col5,Col6,Col7,Col8,Status,Phone,Col11,VoucherId',
      '1,REF1,a,b,c,d,e,f,ยังไม่ได้แจก,0812345678,j,VID1',
    ]);
    mockPrisma.customer.findUnique.mockResolvedValue({
      id: 'c1',
      wallet: { walletAddress: '0xCUST' },
    });
    mockPrisma.voucherCode.findFirst.mockResolvedValue({
      id: 'code1',
      code: 'CODE-1',
      currentOwnerId: 'm1',
      voucherId: 'v1',
      voucher: { id: 'v1' },
    });
    mockTransferHandler.execute.mockResolvedValue({
      transactionHash: '0xTXHASH',
    });

    const result = await handler.execute({ buffer });

    expect(mockPrisma.voucherCode.findFirst).toHaveBeenCalledWith({
      where: {
        voucherId: 'VID1',
        voucher: { merchantRef: 'REF1' },
        currentOwnerType: 'MERCHANT',
        isUsed: false,
        voucherGroupId: null,
        pointId: null,
      },
      include: { voucher: true },
      orderBy: { id: 'asc' },
    });
    expect(mockTransferHandler.execute).toHaveBeenCalledWith({
      merchantId: 'm1',
      customerPhone: '0812345678',
      voucherId: 'v1',
      quantity: 1,
    });
    expect(result.summary.successCount).toBe(1);
    expect(result.payload.successTransfers[0]).toMatchObject({
      sequenceNo: '1',
      phone: '0812345678',
      merchantRef: 'REF1',
      txHash: '0xTXHASH',
    });
  });

  it('should add to failedTransfers when transfer throws', async () => {
    const buffer = makeCsvBuffer([
      'Seq,MerchantRef,Col3,VoucherName,Col5,Col6,Col7,Col8,Status,Phone,Col11,VoucherId',
      '1,REF1,a,b,c,d,e,f,ยังไม่ได้แจก,0812345678,j,VID1',
    ]);
    mockPrisma.customer.findUnique.mockResolvedValue({
      id: 'c1',
      wallet: { walletAddress: '0xCUST' },
    });
    mockPrisma.voucherCode.findFirst.mockResolvedValue({
      id: 'code1',
      code: 'CODE-1',
      currentOwnerId: 'm1',
      voucherId: 'v1',
      voucher: { id: 'v1' },
    });
    mockTransferHandler.execute.mockRejectedValue(
      new Error('On-chain transfer failed'),
    );

    const result = await handler.execute({ buffer });

    expect(result.summary.successCount).toBe(0);
    expect(result.summary.failedTransferCount).toBe(1);
    expect(result.payload.failedTransfers[0].reason).toBe(
      'On-chain transfer failed',
    );
  });

  it('should process multiple rows with mixed outcomes', async () => {
    const buffer = makeCsvBuffer([
      'Seq,MerchantRef,Col3,VoucherName,Col5,Col6,Col7,Col8,Status,Phone,Col11,VoucherId',
      '1,REF1,a,b,c,d,e,f,ยังไม่ได้แจก,0811111111,j,VID1',
      '2,REF2,a,b,c,d,e,f,ยังไม่ได้แจก,0822222222,j,VID2',
      '3,REF3,a,b,c,d,e,f,แจกแล้ว,0833333333,j,VID3',
    ]);
    mockPrisma.customer.findUnique
      .mockResolvedValueOnce({ id: 'c1', wallet: { walletAddress: '0x1' } })
      .mockResolvedValueOnce(null);
    mockPrisma.voucherCode.findFirst.mockResolvedValueOnce({
      id: 'code1',
      code: 'CODE-1',
      currentOwnerId: 'm1',
      voucherId: 'v1',
      voucher: { id: 'v1' },
    });
    mockTransferHandler.execute.mockResolvedValueOnce({
      transactionHash: '0xABC',
    });

    const result = await handler.execute({ buffer });

    expect(result.summary.totalRecordsProcessed).toBe(3);
    expect(result.summary.successCount).toBe(1);
    expect(result.summary.notFoundCustomers).toBe(1);
  });

  it('should handle customer without wallet', async () => {
    const buffer = makeCsvBuffer([
      'Seq,MerchantRef,Col3,VoucherName,Col5,Col6,Col7,Col8,Status,Phone,Col11,VoucherId',
      '1,REF1,a,b,c,d,e,f,ยังไม่ได้แจก,0812345678,j,VID1',
    ]);
    mockPrisma.customer.findUnique.mockResolvedValue({
      id: 'c1',
      wallet: null,
    });
    mockPrisma.voucherCode.findFirst.mockResolvedValue({
      id: 'code1',
      code: 'CODE-1',
      currentOwnerId: 'm1',
      voucherId: 'v1',
      voucher: { id: 'v1' },
    });
    mockTransferHandler.execute.mockResolvedValue({
      transactionHash: '0xTX',
    });

    const result = await handler.execute({ buffer });

    expect(result.payload.successTransfers[0].customerWallet).toBeNull();
  });

  it('should throw BadRequestException on unexpected DB error', async () => {
    const buffer = makeCsvBuffer([
      'Seq,MerchantRef,Col3,VoucherName,Col5,Col6,Col7,Col8,Status,Phone,Col11,VoucherId',
      '1,REF1,a,b,c,d,e,f,ยังไม่ได้แจก,0812345678,j,VID1',
    ]);
    mockPrisma.customer.findUnique.mockRejectedValue(new Error('DB crash'));

    await expect(handler.execute({ buffer })).rejects.toThrow(
      BadRequestException,
    );
  });
});
