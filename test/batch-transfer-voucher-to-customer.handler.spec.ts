jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));
jest.mock('src/libs/derive-wallet', () => ({
  getSignerFromSeedPhrase: jest
    .fn()
    .mockReturnValue({ privateKey: '0xMerchantKey' }),
}));

import {
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { BatchTransferVoucherToCustomerHandler } from '../src/modules/internal/voucher/handlers/batchTransferVoucherToCustomer.handler';
import { PrismaService } from 'prisma/prisma.service';
import { BlockchainService } from '../src/providers/blockchain/blockchain.service';
import { TokenService } from '../src/providers/token/token.service';
import { ConfigService } from '@nestjs/config';

describe('BatchTransferVoucherToCustomerHandler', () => {
  let handler: BatchTransferVoucherToCustomerHandler;
  let prisma: any;
  let blockchainService: any;
  let tokenService: any;
  let configService: any;

  const merchantId = 'merchant-1';

  const mockMerchant = {
    id: merchantId,
    wallet: {
      walletAddress: '0xMerchantAddr',
      seedPhrase: 'encrypted_seed',
      derivationIndex: 0,
    },
  };

  const mockCustomer = {
    id: 'customer-1',
    tel: '0812345678',
    wallet: { walletAddress: '0xCustomerAddr' },
  };

  const mockVoucher = {
    id: 'voucher-1',
    tokenId: '10',
    merchantRef: 'REF001',
  };

  const validTransfers = [
    { customerPhone: '0812345678', voucherId: 'voucher-1', quantity: 1 },
  ];

  beforeEach(() => {
    prisma = {
      merchant: { findUnique: jest.fn() },
      customer: { findMany: jest.fn() },
      voucher: { findMany: jest.fn() },
      $queryRawUnsafe: jest.fn(),
      $transaction: jest.fn(),
      voucherCode: { updateMany: jest.fn() },
      transaction: { create: jest.fn() },
      directTransferOperation: {
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    blockchainService = {
      submitCouponTransfer: jest.fn(),
      waitForCouponTransferReceipt: jest.fn(),
    };
    tokenService = { decryptKey: jest.fn().mockReturnValue('decrypted_seed') };
    configService = { get: jest.fn().mockReturnValue('salt123') };

    handler = new BatchTransferVoucherToCustomerHandler(
      prisma as unknown as PrismaService,
      blockchainService as unknown as BlockchainService,
      tokenService as unknown as TokenService,
      configService as unknown as ConfigService,
    );
  });

  describe('input validation', () => {
    it('should throw BadRequestException when transfers is not an array', async () => {
      await expect(
        handler.execute({ merchantId, transfers: 'bad' as any }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when transfers exceed 1000 items', async () => {
      const bigTransfers = Array.from({ length: 1001 }, () => ({
        customerPhone: '0812345678',
        voucherId: 'v1',
        quantity: 1,
      }));

      await expect(
        handler.execute({ merchantId, transfers: bigTransfers }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('merchant validation', () => {
    it('should throw NotFoundException when merchant not found', async () => {
      prisma.merchant.findUnique.mockResolvedValue(null);

      await expect(
        handler.execute({ merchantId, transfers: validTransfers }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when merchant has no wallet', async () => {
      prisma.merchant.findUnique.mockResolvedValue({
        id: merchantId,
        wallet: null,
      });

      await expect(
        handler.execute({ merchantId, transfers: validTransfers }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when merchant wallet has no seedPhrase', async () => {
      prisma.merchant.findUnique.mockResolvedValue({
        id: merchantId,
        wallet: { walletAddress: '0x1', seedPhrase: null, derivationIndex: 0 },
      });

      await expect(
        handler.execute({ merchantId, transfers: validTransfers }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('customer validation', () => {
    it('should throw NotFoundException when customer phone not found', async () => {
      prisma.merchant.findUnique.mockResolvedValue(mockMerchant);
      prisma.customer.findMany.mockResolvedValue([]);

      await expect(
        handler.execute({ merchantId, transfers: validTransfers }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when customer has no wallet', async () => {
      prisma.merchant.findUnique.mockResolvedValue(mockMerchant);
      prisma.customer.findMany.mockResolvedValue([
        { id: 'c1', tel: '0812345678', wallet: null },
      ]);

      await expect(
        handler.execute({ merchantId, transfers: validTransfers }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('voucher validation', () => {
    it('should throw NotFoundException when voucher not found', async () => {
      prisma.merchant.findUnique.mockResolvedValue(mockMerchant);
      prisma.customer.findMany.mockResolvedValue([mockCustomer]);
      prisma.voucher.findMany.mockResolvedValue([]);

      await expect(
        handler.execute({ merchantId, transfers: validTransfers }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when voucher has no tokenId', async () => {
      prisma.merchant.findUnique.mockResolvedValue(mockMerchant);
      prisma.customer.findMany.mockResolvedValue([mockCustomer]);
      prisma.voucher.findMany.mockResolvedValue([
        { id: 'voucher-1', tokenId: null },
      ]);

      await expect(
        handler.execute({ merchantId, transfers: validTransfers }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when not enough stock', async () => {
      prisma.merchant.findUnique.mockResolvedValue(mockMerchant);
      prisma.customer.findMany.mockResolvedValue([mockCustomer]);
      prisma.voucher.findMany.mockResolvedValue([mockVoucher]);
      prisma.$queryRawUnsafe.mockResolvedValue([]); // 0 codes available

      await expect(
        handler.execute({ merchantId, transfers: validTransfers }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('successful batch transfer', () => {
    const txHash = '0xBatchTxHash';
    const mockTx = { id: 'db-tx-1' };

    beforeEach(() => {
      prisma.merchant.findUnique.mockResolvedValue(mockMerchant);
      prisma.customer.findMany.mockResolvedValue([mockCustomer]);
      prisma.voucher.findMany.mockResolvedValue([mockVoucher]);
      prisma.$queryRawUnsafe.mockImplementation(
        async (
          _sql: string,
          _voucherId: string,
          _merchantId: string,
          qty: number,
        ) => [{ id: 'code-1' }, { id: 'code-2' }].slice(0, qty),
      );
      blockchainService.submitCouponTransfer.mockResolvedValue(txHash);
      blockchainService.waitForCouponTransferReceipt.mockResolvedValue(
        undefined,
      );
      prisma.directTransferOperation.create.mockResolvedValue({
        id: 'operation-1',
      });
      prisma.directTransferOperation.update.mockResolvedValue({
        id: 'operation-1',
      });
      prisma.voucherCode.updateMany.mockImplementation(
        async ({ where }: any) => ({
          count: where.id?.in?.length ?? 0,
        }),
      );
      prisma.transaction.create.mockResolvedValue(mockTx);
      prisma.$transaction.mockImplementation(async (fn: any) => fn(prisma));
    });

    it('should return batch result with success', async () => {
      const result = await handler.execute({
        merchantId,
        transfers: validTransfers,
      });

      expect(result.successful).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.totalProcessed).toBe(1);
      expect(result.results[0].status).toBe('SUCCESS');
      expect(result.results[0].transactionHash).toBe(txHash);
      expect(result.results[0].operationId).toBe('operation-1');
      expect(blockchainService.submitCouponTransfer).toHaveBeenCalledWith(
        10,
        1,
        '0xMerchantAddr',
        '0xCustomerAddr',
        '0xMerchantKey',
      );
      expect(
        blockchainService.waitForCouponTransferReceipt,
      ).toHaveBeenCalledWith(txHash);
    });

    it('should return batchJobId as UUID', async () => {
      const result = await handler.execute({
        merchantId,
        transfers: validTransfers,
      });

      expect(result.batchJobId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });

    it('should mark item as FAILED when blockchain throws', async () => {
      blockchainService.submitCouponTransfer.mockRejectedValue(
        new Error('TX reverted'),
      );

      const result = await handler.execute({
        merchantId,
        transfers: validTransfers,
      });

      expect(result.failed).toBe(1);
      expect(result.successful).toBe(0);
      expect(result.results[0].status).toBe('FAILED');
      expect(result.results[0].error).toBe('TX reverted');
    });

    it('should process multiple transfers and aggregate results', async () => {
      const transfers = [
        { customerPhone: '0812345678', voucherId: 'voucher-1', quantity: 1 },
        { customerPhone: '0812345678', voucherId: 'voucher-1', quantity: 1 },
      ];
      prisma.$queryRawUnsafe.mockResolvedValue([
        { id: 'code-1' },
        { id: 'code-2' },
      ]);

      const result = await handler.execute({ merchantId, transfers });

      expect(result.totalProcessed).toBe(2);
    });
  });

  describe('error handling', () => {
    it('should throw InternalServerErrorException on unexpected errors', async () => {
      prisma.merchant.findUnique.mockRejectedValue(
        new Error('DB connection lost'),
      );

      await expect(
        handler.execute({ merchantId, transfers: validTransfers }),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should re-throw BadRequestException directly', async () => {
      prisma.merchant.findUnique.mockRejectedValue(
        new BadRequestException('direct bad request'),
      );

      await expect(
        handler.execute({ merchantId, transfers: validTransfers }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw InternalServerErrorException when decryptKey returns null', async () => {
      prisma.merchant.findUnique.mockResolvedValue(mockMerchant);
      prisma.customer.findMany.mockResolvedValue([mockCustomer]);
      prisma.voucher.findMany.mockResolvedValue([mockVoucher]);
      prisma.$queryRawUnsafe.mockResolvedValue([{ id: 'code-1' }]);
      tokenService.decryptKey.mockReturnValue(null);

      await expect(
        handler.execute({ merchantId, transfers: validTransfers }),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });
});
