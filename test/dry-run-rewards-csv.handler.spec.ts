jest.mock('prisma/prisma.service', () => ({ PrismaService: jest.fn() }));

import { BadRequestException } from '@nestjs/common';
import { DryRunRewardsCsvHandler } from 'src/modules/internal/admin/handlers/dry-run-rewards-csv.handler';

describe('DryRunRewardsCsvHandler', () => {
  let handler: DryRunRewardsCsvHandler;
  let mockPrisma: any;

  const makeCsvBuffer = (rows: string[]) => {
    const csv = rows.join('\n');
    return Buffer.from(csv, 'utf-8');
  };

  beforeEach(() => {
    mockPrisma = {
      customer: { findUnique: jest.fn() },
      voucherCode: { findFirst: jest.fn() },
    };
    handler = new DryRunRewardsCsvHandler(mockPrisma);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should throw BadRequestException when no file provided', async () => {
    await expect(handler.execute(null)).rejects.toThrow(BadRequestException);
    await expect(handler.execute({})).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException when file is too large', async () => {
    const bigBuffer = Buffer.alloc(6 * 1024 * 1024, 'x');
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
    expect(result.summary.readyToDistribute).toBe(0);
    expect(result.payload.toDistribute).toEqual([]);
  });

  it('should skip rows with less than 12 columns', async () => {
    const buffer = makeCsvBuffer([
      'Seq,MerchantRef,Col3,VoucherName,Col5,Col6,Col7,Col8,Status,Phone,Col11,VoucherId',
      '1,REF1,extra',
    ]);

    const result = await handler.execute({ buffer });

    expect(result.summary.totalRecordsProcessed).toBe(1);
    expect(result.summary.readyToDistribute).toBe(0);
    expect(result.payload.toDistribute).toEqual([]);
  });

  it('should skip rows where status is not "ยังไม่ได้แจก"', async () => {
    const buffer = makeCsvBuffer([
      'Seq,MerchantRef,Col3,VoucherName,Col5,Col6,Col7,Col8,Status,Phone,Col11,VoucherId',
      '1,REF1,a,b,c,d,e,f,แจกแล้ว,0812345678,j,VID1',
    ]);

    const result = await handler.execute({ buffer });

    expect(result.summary.readyToDistribute).toBe(0);
  });

  it('should skip rows where phone is empty', async () => {
    const buffer = makeCsvBuffer([
      'Seq,MerchantRef,Col3,VoucherName,Col5,Col6,Col7,Col8,Status,Phone,Col11,VoucherId',
      '1,REF1,a,b,c,d,e,f,ยังไม่ได้แจก,,j,VID1',
    ]);

    const result = await handler.execute({ buffer });

    expect(result.summary.readyToDistribute).toBe(0);
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

  it('should add to notFoundMerchants when no available code found', async () => {
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

    expect(result.summary.notFoundMerchants).toBe(1);
    expect(result.payload.notFoundMerchants[0].reason).toBe(
      'NO_QUOTA_OR_MERCHANT_NOT_FOUND',
    );
  });

  it('should add to toDistribute when customer and code found', async () => {
    const buffer = makeCsvBuffer([
      'Seq,MerchantRef,Col3,VoucherName,Col5,Col6,Col7,Col8,Status,Phone,Col11,VoucherId',
      '1,REF1,a,VoucherName,c,d,e,f,ยังไม่ได้แจก,0812345678,j,VID1',
    ]);
    mockPrisma.customer.findUnique.mockResolvedValue({
      id: 'c1',
      wallet: { walletAddress: '0xCUST' },
    });
    mockPrisma.voucherCode.findFirst.mockResolvedValue({
      id: 'code1',
      code: 'CODE-1',
      currentOwnerId: 'm1',
      voucher: { id: 'v1' },
    });

    const result = await handler.execute({ buffer });

    expect(result.summary.readyToDistribute).toBe(1);
    expect(result.payload.toDistribute[0]).toMatchObject({
      sequenceNo: '1',
      phone: '0812345678',
      customerWallet: '0xCUST',
      customerId: 'c1',
      merchantRef: 'REF1',
      merchantId: 'm1',
      availableCode: 'CODE-1',
      availableCodeId: 'code1',
      status: 'READY',
    });
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
      voucher: { id: 'v1' },
    });

    const result = await handler.execute({ buffer });

    expect(result.payload.toDistribute[0].customerWallet).toBeNull();
  });

  it('should handle multiple rows correctly', async () => {
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
      voucher: { id: 'v1' },
    });

    const result = await handler.execute({ buffer });

    expect(result.summary.totalRecordsProcessed).toBe(3);
    expect(result.summary.readyToDistribute).toBe(1);
    expect(result.summary.notFoundCustomers).toBe(1);
  });

  it('should handle quoted CSV fields correctly', async () => {
    const buffer = Buffer.from(
      'Seq,MerchantRef,Col3,VoucherName,Col5,Col6,Col7,Col8,Status,Phone,Col11,VoucherId\n' +
        '1,"REF,1",a,b,c,d,e,f,ยังไม่ได้แจก,0812345678,j,VID1\n',
      'utf-8',
    );
    mockPrisma.customer.findUnique.mockResolvedValue({
      id: 'c1',
      wallet: { walletAddress: '0x1' },
    });
    mockPrisma.voucherCode.findFirst.mockResolvedValue({
      id: 'code1',
      code: 'CODE-1',
      currentOwnerId: 'm1',
      voucher: { id: 'v1' },
    });

    const result = await handler.execute({ buffer });

    expect(result.payload.toDistribute[0].merchantRef).toBe('REF,1');
  });

  it('should throw BadRequestException on unexpected error', async () => {
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
