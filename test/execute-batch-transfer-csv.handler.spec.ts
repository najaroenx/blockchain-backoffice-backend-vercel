jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  ExecuteBatchTransferCsvHandler,
  UploadedCsvFile,
} from 'src/modules/internal/voucher/handlers/executeBatchTransferCsv.handler';

describe('ExecuteBatchTransferCsvHandler', () => {
  let handler: ExecuteBatchTransferCsvHandler;
  let prisma: any;
  let blockchainService: any;
  let tokenService: any;
  let configService: any;

  const mockMerchant = {
    id: 'merchant-1',
    wallet: {
      walletAddress: '0xMerchantWallet',
      seedPhrase: 'encrypted_seed_phrase',
      derivationIndex: 0,
    },
  };

  const mockCustomer = {
    id: 'customer-1',
    tel: '0812345678',
    wallet: {
      walletAddress: '0xCustomerWallet',
    },
  };

  const mockVoucher = {
    id: 'voucher-1',
    tokenId: '10',
    merchantRef: 'VCH-NARA-01',
  };

  const mockVoucherCodes = [
    { id: 'code-1', voucherId: 'voucher-1' },
    { id: 'code-2', voucherId: 'voucher-1' },
  ];

  beforeEach(() => {
    prisma = {
      merchant: { findUnique: jest.fn() },
      customer: { findMany: jest.fn() },
      voucher: { findMany: jest.fn() },
      voucherCode: { updateMany: jest.fn() },
      transaction: { create: jest.fn() },
      batchTransferLog: { create: jest.fn() },
      $queryRawUnsafe: jest.fn(),
      $transaction: jest.fn((callback) => callback(prisma)),
    };

    blockchainService = {
      transferCoupon: jest.fn().mockResolvedValue('0xTxHash123'),
    };

    tokenService = {
      decryptKey: jest
        .fn()
        .mockReturnValue(
          'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
        ),
    };

    configService = {
      get: jest.fn().mockReturnValue('mock_salt'),
    };

    handler = new ExecuteBatchTransferCsvHandler(
      prisma,
      blockchainService,
      tokenService,
      configService,
    );
  });

  it('should successfully execute and record CSV batch transfer to log table', async () => {
    prisma.merchant.findUnique.mockResolvedValue(mockMerchant);
    prisma.customer.findMany.mockResolvedValue([mockCustomer]);
    prisma.voucher.findMany.mockResolvedValue([mockVoucher]);
    prisma.$queryRawUnsafe.mockResolvedValue(mockVoucherCodes);

    const csvContent = 'phone,voucherId,qty\n0812345678,voucher-1,2\n';
    const mockFile: UploadedCsvFile = {
      fieldname: 'file',
      originalname: 'rewards_2026.csv',
      encoding: '7bit',
      mimetype: 'text/csv',
      buffer: Buffer.from(csvContent, 'utf-8'),
      size: csvContent.length,
    };

    const response = await handler.execute('merchant-1', mockFile);

    expect(response.totalProcessed).toBe(1);
    expect(response.successful).toBe(1);
    expect(response.failed).toBe(0);
    expect(response.results[0].status).toBe('SUCCESS');
    expect(response.results[0].transactionHash).toBe('0xTxHash123');

    // Ensure BatchTransferLog is written correctly
    expect(prisma.batchTransferLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          merchantId: 'merchant-1',
          fileName: 'rewards_2026.csv',
          totalRecords: 1,
          successfulCount: 1,
          failedCount: 0,
          status: 'SUCCESS',
        }),
      }),
    );
  });

  it('should fail-early if merchant seed phrase can not be decrypted', async () => {
    prisma.merchant.findUnique.mockResolvedValue(mockMerchant);
    prisma.customer.findMany.mockResolvedValue([mockCustomer]);
    prisma.voucher.findMany.mockResolvedValue([mockVoucher]);
    prisma.$queryRawUnsafe.mockResolvedValue(mockVoucherCodes);
    tokenService.decryptKey.mockReturnValue(null); // Failed decrypt

    const csvContent = 'phone,voucherId,qty\n0812345678,voucher-1,2\n';
    const mockFile: UploadedCsvFile = {
      fieldname: 'file',
      originalname: 'rewards_2026.csv',
      encoding: '7bit',
      mimetype: 'text/csv',
      buffer: Buffer.from(csvContent, 'utf-8'),
      size: csvContent.length,
    };

    await expect(handler.execute('merchant-1', mockFile)).rejects.toThrow(
      'Failed to decrypt merchant seed phrase',
    );
  });

  it('should continue processing with status FAILED for individual invalid rows', async () => {
    prisma.merchant.findUnique.mockResolvedValue(mockMerchant);
    prisma.customer.findMany.mockResolvedValue([mockCustomer]);
    prisma.voucher.findMany.mockResolvedValue([mockVoucher]);
    prisma.$queryRawUnsafe.mockResolvedValue(mockVoucherCodes);

    // Row 1: Valid
    // Row 2: Customer unregistered
    const csvContent =
      'phone,voucherId,qty\n0812345678,voucher-1,1\n0899999999,voucher-1,1\n';
    const mockFile: UploadedCsvFile = {
      fieldname: 'file',
      originalname: 'rewards_2026.csv',
      encoding: '7bit',
      mimetype: 'text/csv',
      buffer: Buffer.from(csvContent, 'utf-8'),
      size: csvContent.length,
    };

    const response = await handler.execute('merchant-1', mockFile);

    expect(response.totalProcessed).toBe(2);
    expect(response.successful).toBe(1);
    expect(response.failed).toBe(1);
    expect(response.results[0].status).toBe('SUCCESS');
    expect(response.results[1].status).toBe('FAILED');
    expect(response.results[1].error).toContain('is unregistered');

    // Expected PARTIAL_FAILED status log
    expect(prisma.batchTransferLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'PARTIAL_FAILED',
          successfulCount: 1,
          failedCount: 1,
        }),
      }),
    );
  });

  it('should reject file if size exceeds limit or row count goes beyond safety margin', async () => {
    prisma.merchant.findUnique.mockResolvedValue(mockMerchant);

    // Dynamic generator to exceed the safe transfer limit (50)
    let extraRows = '';
    for (let i = 0; i < 55; i++) {
      extraRows += `0812345678,voucher-1,1\n`;
    }
    const csvContent = `phone,voucherId,qty\n${extraRows}`;
    const mockFile: UploadedCsvFile = {
      fieldname: 'file',
      originalname: 'huge.csv',
      encoding: '7bit',
      mimetype: 'text/csv',
      buffer: Buffer.from(csvContent, 'utf-8'),
      size: csvContent.length,
    };

    await expect(handler.execute('merchant-1', mockFile)).rejects.toThrow(
      'limit of 50',
    );
  });

  it('should capture desynchronization if blockchain succeeds but ledger writing fails in Prisma', async () => {
    prisma.merchant.findUnique.mockResolvedValue(mockMerchant);
    prisma.customer.findMany.mockResolvedValue([mockCustomer]);
    prisma.voucher.findMany.mockResolvedValue([mockVoucher]);
    prisma.$queryRawUnsafe.mockResolvedValue(mockVoucherCodes);

    // Mock Prisma $transaction failing with DB error
    prisma.$transaction.mockRejectedValue(
      new Error('Prisma database connection lost'),
    );

    const csvContent = 'phone,voucherId,qty\n0812345678,voucher-1,1\n';
    const mockFile: UploadedCsvFile = {
      fieldname: 'file',
      originalname: 'rewards_2026.csv',
      encoding: '7bit',
      mimetype: 'text/csv',
      buffer: Buffer.from(csvContent, 'utf-8'),
      size: csvContent.length,
    };

    const response = await handler.execute('merchant-1', mockFile);

    expect(response.totalProcessed).toBe(1);
    expect(response.successful).toBe(0);
    expect(response.failed).toBe(1);
    expect(response.results[0].status).toBe('FAILED');
    expect(response.results[0].error).toContain('Prisma Database Error');
    expect(response.results[0].transactionHash).toBe('0xTxHash123'); // must keep hash!
    expect(response.results[0].isDesynced).toBe(true);
    expect(response.results[0].desyncMessage).toBeDefined();

    // Ensure BatchTransferLog status is logged as FAILED or PARTIAL_FAILED
    expect(prisma.batchTransferLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'FAILED',
          successfulCount: 0,
          failedCount: 1,
        }),
      }),
    );
  });
});
