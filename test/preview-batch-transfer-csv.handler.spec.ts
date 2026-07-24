jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  PreviewBatchTransferCsvHandler,
  UploadedCsvFile,
} from 'src/modules/internal/voucher/handlers/previewBatchTransferCsv.handler';

describe('PreviewBatchTransferCsvHandler', () => {
  let handler: PreviewBatchTransferCsvHandler;
  let prisma: any;

  const mockMerchant = {
    id: 'merchant-1',
    wallet: {
      walletAddress: '0xMerchantWallet',
      seedPhrase: 'some seed phrase',
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
  };

  beforeEach(() => {
    prisma = {
      merchant: { findUnique: jest.fn() },
      customer: { findMany: jest.fn() },
      voucher: { findMany: jest.fn() },
      voucherCode: { groupBy: jest.fn() },
    };
    handler = new PreviewBatchTransferCsvHandler(prisma);
  });

  it('should successfully parse and approve a completely valid CSV transfer file', async () => {
    prisma.merchant.findUnique.mockResolvedValue(mockMerchant);
    prisma.customer.findMany.mockResolvedValue([mockCustomer]);
    prisma.voucher.findMany.mockResolvedValue([mockVoucher]);
    prisma.voucherCode.groupBy.mockResolvedValue([
      {
        voucherId: 'voucher-1',
        _count: { id: 5 },
      },
    ]);

    const csvContent = 'phone,voucherId,qty\n0812345678,voucher-1,2\n';
    const mockFile: UploadedCsvFile = {
      fieldname: 'file',
      originalname: 'transfer.csv',
      encoding: '7bit',
      mimetype: 'text/csv',
      buffer: Buffer.from(csvContent, 'utf-8'),
      size: csvContent.length,
    };

    const response = await handler.execute('merchant-1', mockFile);

    expect(response.isValidAll).toBe(true);
    expect(response.summary.totalRowsProcessed).toBe(1);
    expect(response.summary.validRowsCount).toBe(1);
    expect(response.summary.invalidRowsCount).toBe(0);
    expect(response.summary.totalQuantity).toBe(2);
    expect(response.details[0].seqNo).toBe(1);
    expect(response.details[0].isValid).toBe(true);
    expect(response.details[0].errors).toHaveLength(0);
  });

  it('should handle dynamic column mapping for different casing and styles', async () => {
    prisma.merchant.findUnique.mockResolvedValue(mockMerchant);
    prisma.customer.findMany.mockResolvedValue([mockCustomer]);
    prisma.voucher.findMany.mockResolvedValue([mockVoucher]);
    prisma.voucherCode.groupBy.mockResolvedValue([
      {
        voucherId: 'voucher-1',
        _count: { id: 5 },
      },
    ]);

    // Use Thai / special columns
    const csvContent = 'เบอร์โทร,คูปอง,จำนวน\n0812345678,voucher-1,3\n';
    const mockFile: UploadedCsvFile = {
      fieldname: 'file',
      originalname: 'transfer.csv',
      encoding: '7bit',
      mimetype: 'text/csv',
      buffer: Buffer.from(csvContent, 'utf-8'),
      size: csvContent.length,
    };

    const response = await handler.execute('merchant-1', mockFile);

    expect(response.isValidAll).toBe(true);
    expect(response.summary.totalQuantity).toBe(3);
    expect(response.details[0].isValid).toBe(true);
  });

  it('should fail and output detailed rows-level errors when customer or voucher can not be found', async () => {
    prisma.merchant.findUnique.mockResolvedValue(mockMerchant);
    // Find customers returns empty array (customer not found)
    prisma.customer.findMany.mockResolvedValue([]);
    // Vouchers returned list doesn't have the specified voucher
    prisma.voucher.findMany.mockResolvedValue([]);
    prisma.voucherCode.groupBy.mockResolvedValue([]);

    const csvContent = 'phone,voucherId,qty\n0812345678,voucher-1,1\n';
    const mockFile: UploadedCsvFile = {
      fieldname: 'file',
      originalname: 'transfer.csv',
      encoding: '7bit',
      mimetype: 'text/csv',
      buffer: Buffer.from(csvContent, 'utf-8'),
      size: csvContent.length,
    };

    const response = await handler.execute('merchant-1', mockFile);

    expect(response.isValidAll).toBe(false);
    expect(response.summary.validRowsCount).toBe(0);
    expect(response.summary.invalidRowsCount).toBe(1);
    expect(response.details[0].isValid).toBe(false);
    expect(response.details[0].errors).toContain(
      "Customer phone number '0812345678' is unregistered",
    );
    expect(response.details[0].errors).toContain(
      "Voucher ID 'voucher-1' does not exist",
    );
  });

  it('should flag insufficient stock or cumulative overallocation when requested quantity surpasses inventory list', async () => {
    prisma.merchant.findUnique.mockResolvedValue(mockMerchant);
    prisma.customer.findMany.mockResolvedValue([mockCustomer]);
    prisma.voucher.findMany.mockResolvedValue([mockVoucher]);
    // Merchant only has 3 available codes
    prisma.voucherCode.groupBy.mockResolvedValue([
      {
        voucherId: 'voucher-1',
        _count: { id: 3 },
      },
    ]);

    // Cumulative sum across rows is 4, which exceeds stock of 3!
    const csvContent =
      'phone,voucherId,qty\n0812345678,voucher-1,2\n0812345678,voucher-1,2\n';
    const mockFile: UploadedCsvFile = {
      fieldname: 'file',
      originalname: 'transfer.csv',
      encoding: '7bit',
      mimetype: 'text/csv',
      buffer: Buffer.from(csvContent, 'utf-8'),
      size: csvContent.length,
    };

    const response = await handler.execute('merchant-1', mockFile);

    expect(response.isValidAll).toBe(false);
    expect(response.summary.validRowsCount).toBe(1); // First row with qty=2 is valid, total requested=2
    expect(response.summary.invalidRowsCount).toBe(1); // Second row with qty=2 makes cumulative=4, exceeds stock of 3!
    expect(response.details[0].isValid).toBe(true);
    expect(response.details[1].isValid).toBe(false);
    expect(response.details[1].errors[0]).toContain(
      'Insufficient voucher code stock',
    );
  });

  it('should exclude Marketplace and Point-configured codes from transferable stock', async () => {
    prisma.merchant.findUnique.mockResolvedValue(mockMerchant);
    prisma.customer.findMany.mockResolvedValue([mockCustomer]);
    prisma.voucher.findMany.mockResolvedValue([mockVoucher]);
    prisma.voucherCode.groupBy.mockImplementation(({ where }) => {
      const usesWalletPoolEligibility =
        where.voucherGroupId === null && where.pointId === null;
      return Promise.resolve([
        {
          voucherId: 'voucher-1',
          _count: { id: usesWalletPoolEligibility ? 3 : 5 },
        },
      ]);
    });

    const csvContent = 'phone,voucherId,qty\n0812345678,voucher-1,4\n';
    const mockFile: UploadedCsvFile = {
      fieldname: 'file',
      originalname: 'transfer.csv',
      encoding: '7bit',
      mimetype: 'text/csv',
      buffer: Buffer.from(csvContent, 'utf-8'),
      size: csvContent.length,
    };

    const response = await handler.execute('merchant-1', mockFile);

    expect(response.isValidAll).toBe(false);
    expect(response.details[0].errors[0]).toContain(
      'merchant only holds 3 codes',
    );
  });

  it('should reject requests with invalid quantities like zero or non-numeric cells', async () => {
    prisma.merchant.findUnique.mockResolvedValue(mockMerchant);
    prisma.customer.findMany.mockResolvedValue([mockCustomer]);
    prisma.voucher.findMany.mockResolvedValue([mockVoucher]);
    prisma.voucherCode.groupBy.mockResolvedValue([
      {
        voucherId: 'voucher-1',
        _count: { id: 10 },
      },
    ]);

    const csvContent =
      'phone,voucherId,qty\n0812345678,voucher-1,-5\n0812345678,voucher-1,abc\n';
    const mockFile: UploadedCsvFile = {
      fieldname: 'file',
      originalname: 'transfer.csv',
      encoding: '7bit',
      mimetype: 'text/csv',
      buffer: Buffer.from(csvContent, 'utf-8'),
      size: csvContent.length,
    };

    const response = await handler.execute('merchant-1', mockFile);

    expect(response.isValidAll).toBe(false);
    expect(response.details[0].isValid).toBe(false);
    expect(response.details[0].errors[0]).toBe(
      'Quantity must be a positive integer greater than zero',
    );
    expect(response.details[1].isValid).toBe(false);
    expect(response.details[1].errors[0]).toBe(
      'Quantity must be a positive integer greater than zero',
    );
  });

  it('should blow up with NotFoundException if merchant does not exist', async () => {
    prisma.merchant.findUnique.mockResolvedValue(null);

    const mockFile: UploadedCsvFile = {
      fieldname: 'file',
      originalname: 'transfer.csv',
      encoding: '7bit',
      mimetype: 'text/csv',
      buffer: Buffer.from(
        'phone,voucherId,qty\n0812345678,voucher-1,1',
        'utf-8',
      ),
      size: 50,
    };

    await expect(handler.execute('invalid-merchant', mockFile)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should blow up with BadRequestException if CSV has no data rows', async () => {
    prisma.merchant.findUnique.mockResolvedValue(mockMerchant);

    const mockFile: UploadedCsvFile = {
      fieldname: 'file',
      originalname: 'transfer.csv',
      encoding: '7bit',
      mimetype: 'text/csv',
      buffer: Buffer.from('phone,voucherId,qty\n', 'utf-8'),
      size: 15,
    };

    await expect(handler.execute('merchant-1', mockFile)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should ignore completely empty or blank template lines at the end of the CSV', async () => {
    prisma.merchant.findUnique.mockResolvedValue(mockMerchant);
    prisma.customer.findMany.mockResolvedValue([mockCustomer]);
    prisma.voucher.findMany.mockResolvedValue([mockVoucher]);
    prisma.voucherCode.groupBy.mockResolvedValue([
      {
        voucherId: 'voucher-1',
        _count: { id: 5 },
      },
    ]);

    const csvContent = 'phone,voucherId,qty\n0812345678,voucher-1,2\n,,\n';
    const mockFile: UploadedCsvFile = {
      fieldname: 'file',
      originalname: 'transfer.csv',
      encoding: '7bit',
      mimetype: 'text/csv',
      buffer: Buffer.from(csvContent, 'utf-8'),
      size: csvContent.length,
    };

    const response = await handler.execute('merchant-1', mockFile);

    expect(response.isValidAll).toBe(true);
    expect(response.summary.totalRowsProcessed).toBe(1);
    expect(response.details).toHaveLength(1);
    expect(response.details[0].seqNo).toBe(1);
  });
});
