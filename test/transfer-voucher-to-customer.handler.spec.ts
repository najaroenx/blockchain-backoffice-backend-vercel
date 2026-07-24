jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));
jest.mock('src/libs/derive-wallet', () => ({
  getSignerFromSeedPhrase: jest
    .fn()
    .mockReturnValue({ privateKey: '0xMerchantKey' }),
}));
jest.mock('src/libs/convertBufferToAddress', () => ({
  convertBufferToAddress: jest.fn(
    (buf) => '0x' + Buffer.from(buf || []).toString('hex'),
  ),
}));

import {
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { TransferVoucherToCustomerHandler } from '../src/modules/internal/voucher/handlers/transferVoucherToCustomer.handler';
import { PrismaService } from 'prisma/prisma.service';
import { BlockchainService } from '../src/providers/blockchain/blockchain.service';
import { TokenService } from '../src/providers/token/token.service';
import { ConfigService } from '@nestjs/config';

describe('TransferVoucherToCustomerHandler', () => {
  let handler: TransferVoucherToCustomerHandler;
  let prisma: any;
  let blockchainService: any;
  let tokenService: any;
  let configService: any;

  const mockMerchant = {
    id: 'merchant-1',
    wallet: {
      walletAddress: '0xMerchantAddr',
      seedPhrase: 'encrypted_seed',
      derivationIndex: 0,
    },
  };

  const mockCustomer = {
    id: 'customer-1',
    wallet: { walletAddress: '0xCustomerAddr' },
  };

  const mockVoucher = {
    id: 'voucher-1',
    tokenId: '42',
    merchantRef: 'REF001',
  };

  const mockAvailableCodes = [
    { id: 'code-1', code: 'CODE001' },
    { id: 'code-2', code: 'CODE002' },
  ];

  beforeEach(() => {
    prisma = {
      merchant: { findUnique: jest.fn() },
      customer: { findUnique: jest.fn() },
      voucher: { findUnique: jest.fn() },
      voucherCode: { updateMany: jest.fn() },
      transaction: { create: jest.fn() },
      directTransferOperation: {
        create: jest.fn(),
        update: jest.fn(),
      },
      $queryRawUnsafe: jest.fn(),
      $transaction: jest.fn(async (fn: any) => fn(prisma)),
    };
    blockchainService = {
      submitCouponTransfer: jest.fn(),
      waitForCouponTransferReceipt: jest.fn(),
    };
    tokenService = { decryptKey: jest.fn().mockReturnValue('decrypted_seed') };
    configService = { get: jest.fn().mockReturnValue('some_salt') };

    handler = new TransferVoucherToCustomerHandler(
      prisma as unknown as PrismaService,
      blockchainService as unknown as BlockchainService,
      tokenService as unknown as TokenService,
      configService as unknown as ConfigService,
    );
  });

  const dto = {
    merchantId: 'merchant-1',
    customerPhone: '0812345678',
    voucherId: 'voucher-1',
    quantity: 2,
  };

  describe('validation errors', () => {
    it('should throw NotFoundException when merchant not found', async () => {
      prisma.merchant.findUnique.mockResolvedValue(null);

      await expect(handler.execute(dto)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when merchant has no wallet', async () => {
      prisma.merchant.findUnique.mockResolvedValue({
        id: 'merchant-1',
        wallet: null,
      });

      await expect(handler.execute(dto)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when merchant wallet has no seedPhrase', async () => {
      prisma.merchant.findUnique.mockResolvedValue({
        id: 'merchant-1',
        wallet: { walletAddress: '0x1', seedPhrase: null, derivationIndex: 0 },
      });

      await expect(handler.execute(dto)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when customer not found', async () => {
      prisma.merchant.findUnique.mockResolvedValue(mockMerchant);
      prisma.customer.findUnique.mockResolvedValue(null);

      await expect(handler.execute(dto)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when customer has no wallet', async () => {
      prisma.merchant.findUnique.mockResolvedValue(mockMerchant);
      prisma.customer.findUnique.mockResolvedValue({ id: 'c1', wallet: null });

      await expect(handler.execute(dto)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when not enough voucher stock', async () => {
      prisma.merchant.findUnique.mockResolvedValue(mockMerchant);
      prisma.customer.findUnique.mockResolvedValue(mockCustomer);
      prisma.voucher.findUnique.mockResolvedValue(mockVoucher);
      prisma.$queryRawUnsafe.mockResolvedValue([{ id: 'code-1', code: 'X' }]);

      let caught: BadRequestException | undefined;
      try {
        await handler.execute(dto);
      } catch (error) {
        caught = error as BadRequestException;
      }

      expect(caught).toBeInstanceOf(BadRequestException);
      expect(caught?.getResponse()).toEqual({
        statusCode: 400,
        code: 'INSUFFICIENT_WALLET_POOL',
        message: 'Insufficient Wallet Pool stock. Requested 2, available 1.',
        voucherId: 'voucher-1',
        requested: 2,
        available: 1,
      });
      expect(blockchainService.submitCouponTransfer).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when voucher not found', async () => {
      prisma.merchant.findUnique.mockResolvedValue(mockMerchant);
      prisma.customer.findUnique.mockResolvedValue(mockCustomer);
      prisma.$queryRawUnsafe.mockResolvedValue(mockAvailableCodes);
      prisma.voucher.findUnique.mockResolvedValue(null);

      await expect(handler.execute(dto)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when voucher has no tokenId', async () => {
      prisma.merchant.findUnique.mockResolvedValue(mockMerchant);
      prisma.customer.findUnique.mockResolvedValue(mockCustomer);
      prisma.$queryRawUnsafe.mockResolvedValue(mockAvailableCodes);
      prisma.voucher.findUnique.mockResolvedValue({ id: 'v1', tokenId: null });

      await expect(handler.execute(dto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('successful transfer', () => {
    const txHash = '0xTxHash';
    const mockTransactions = [{ id: 'tx-1' }, { id: 'tx-2' }];

    beforeEach(() => {
      prisma.merchant.findUnique.mockResolvedValue(mockMerchant);
      prisma.customer.findUnique.mockResolvedValue(mockCustomer);
      prisma.$queryRawUnsafe.mockResolvedValue(mockAvailableCodes);
      prisma.voucher.findUnique.mockResolvedValue(mockVoucher);
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
      prisma.transaction.create
        .mockResolvedValueOnce(mockTransactions[0])
        .mockResolvedValueOnce(mockTransactions[1]);
    });

    it('should return success response with transactionHash', async () => {
      const result = await handler.execute(dto);

      expect(result.message).toBe('Voucher transfer successful');
      expect(result.transactionHash).toBe(txHash);
      expect(result.operationId).toBe('operation-1');
      expect(result.transferredQuantity).toBe(2);
      expect(result.voucherCodeIds).toEqual(['code-1', 'code-2']);
    });

    it('should persist SUBMITTED before waiting for confirmation', async () => {
      await handler.execute(dto);

      expect(blockchainService.submitCouponTransfer).toHaveBeenCalledWith(
        42,
        2,
        '0xMerchantAddr',
        '0xCustomerAddr',
        '0xMerchantKey',
      );
      expect(
        blockchainService.waitForCouponTransferReceipt,
      ).toHaveBeenCalledWith(txHash);

      const submittedUpdate =
        prisma.directTransferOperation.update.mock.calls.find(
          ([args]: any[]) => args.data.status === 'SUBMITTED',
        );
      expect(submittedUpdate?.[0].data.txHash).toBe(txHash);
      expect(
        blockchainService.submitCouponTransfer.mock.invocationCallOrder[0],
      ).toBeLessThan(
        prisma.directTransferOperation.update.mock.invocationCallOrder[0],
      );
      expect(
        prisma.directTransferOperation.update.mock.invocationCallOrder[0],
      ).toBeLessThan(
        blockchainService.waitForCouponTransferReceipt.mock
          .invocationCallOrder[0],
      );
    });

    it('should lock only deterministic Wallet Pool rows', async () => {
      await handler.execute(dto);

      const [sql, voucherId, merchantId, quantity] =
        prisma.$queryRawUnsafe.mock.calls[0];

      expect(sql).toContain('"voucherGroupId" IS NULL');
      expect(sql).toContain('"pointId" IS NULL');
      expect(sql).toContain('ORDER BY "id" ASC');
      expect(sql).toContain('FOR UPDATE SKIP LOCKED');
      expect([voucherId, merchantId, quantity]).toEqual([
        'voucher-1',
        'merchant-1',
        2,
      ]);
    });

    it('should use default quantity of 1 when not provided', async () => {
      const dtoNoQty = {
        merchantId: 'merchant-1',
        customerPhone: '0812345678',
        voucherId: 'voucher-1',
      };
      prisma.$queryRawUnsafe.mockResolvedValue([{ id: 'code-1', code: 'X' }]);
      prisma.transaction.create.mockResolvedValueOnce({ id: 'tx-1' });

      const result = await handler.execute(dtoNoQty);

      expect(result.transferredQuantity).toBe(1);
    });

    it('should call tokenService.decryptKey with salt and seedPhrase', async () => {
      await handler.execute(dto);

      expect(tokenService.decryptKey).toHaveBeenCalledWith(
        'some_salt',
        'encrypted_seed',
      );
    });

    it('should write Wallet Pool provenance without a Point payment or pointId', async () => {
      await handler.execute(dto);

      expect(prisma.transaction.create).toHaveBeenCalledTimes(2);
      for (const [args] of prisma.transaction.create.mock.calls) {
        expect(args.data).toEqual(
          expect.objectContaining({
            type: 'VOUCHER',
            sourcePool: 'WALLET_POOL',
            transactionRefId: 'operation-1',
          }),
        );
        expect(args.data).not.toHaveProperty('pointId');
      }
    });
  });

  describe('error handling', () => {
    it('should throw InternalServerErrorException when decryptKey returns null', async () => {
      prisma.merchant.findUnique.mockResolvedValue(mockMerchant);
      prisma.customer.findUnique.mockResolvedValue(mockCustomer);
      prisma.$queryRawUnsafe.mockResolvedValue(mockAvailableCodes);
      prisma.voucher.findUnique.mockResolvedValue(mockVoucher);
      tokenService.decryptKey.mockReturnValue(null);

      await expect(handler.execute(dto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should re-throw NotFoundException from inner calls', async () => {
      prisma.merchant.findUnique.mockRejectedValue(
        new NotFoundException('not found'),
      );

      await expect(handler.execute(dto)).rejects.toThrow(NotFoundException);
    });

    it('should wrap unexpected errors in InternalServerErrorException', async () => {
      prisma.merchant.findUnique.mockRejectedValue(new Error('DB crash'));

      await expect(handler.execute(dto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should keep reserved codes for manual review when submission fails before a tx hash exists', async () => {
      prisma.merchant.findUnique.mockResolvedValue(mockMerchant);
      prisma.customer.findUnique.mockResolvedValue(mockCustomer);
      prisma.voucher.findUnique.mockResolvedValue(mockVoucher);
      prisma.$queryRawUnsafe.mockResolvedValue(mockAvailableCodes);
      prisma.directTransferOperation.create.mockResolvedValue({
        id: 'operation-1',
      });
      prisma.voucherCode.updateMany.mockResolvedValue({ count: 2 });
      blockchainService.submitCouponTransfer.mockRejectedValue(
        new Error('RPC rejected submission'),
      );

      await expect(handler.execute(dto)).rejects.toThrow(
        InternalServerErrorException,
      );

      expect(prisma.voucherCode.updateMany).not.toHaveBeenCalledWith({
        where: { directTransferOperationId: 'operation-1' },
        data: { directTransferOperationId: null },
      });
      expect(prisma.directTransferOperation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'operation-1' },
          data: expect.objectContaining({ status: 'MANUAL_REVIEW' }),
        }),
      );
    });

    it('should release reserved codes when the transaction is confirmed reverted', async () => {
      const revertedError = Object.assign(new Error('reverted'), {
        code: 'COUPON_TRANSFER_REVERTED',
      });
      prisma.merchant.findUnique.mockResolvedValue(mockMerchant);
      prisma.customer.findUnique.mockResolvedValue(mockCustomer);
      prisma.voucher.findUnique.mockResolvedValue(mockVoucher);
      prisma.$queryRawUnsafe.mockResolvedValue(mockAvailableCodes);
      prisma.directTransferOperation.create.mockResolvedValue({
        id: 'operation-1',
      });
      prisma.voucherCode.updateMany.mockResolvedValue({ count: 2 });
      blockchainService.submitCouponTransfer.mockResolvedValue('0xFailed');
      blockchainService.waitForCouponTransferReceipt.mockRejectedValue(
        revertedError,
      );

      await expect(handler.execute(dto)).rejects.toThrow(
        InternalServerErrorException,
      );

      expect(prisma.voucherCode.updateMany).toHaveBeenCalledWith({
        where: { directTransferOperationId: 'operation-1' },
        data: { directTransferOperationId: null },
      });
      expect(prisma.directTransferOperation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'operation-1' },
          data: expect.objectContaining({ status: 'CHAIN_FAILED' }),
        }),
      );
    });

    it('should keep reserved codes for manual review when receipt state is unknown', async () => {
      prisma.merchant.findUnique.mockResolvedValue(mockMerchant);
      prisma.customer.findUnique.mockResolvedValue(mockCustomer);
      prisma.voucher.findUnique.mockResolvedValue(mockVoucher);
      prisma.$queryRawUnsafe.mockResolvedValue(mockAvailableCodes);
      prisma.directTransferOperation.create.mockResolvedValue({
        id: 'operation-1',
      });
      prisma.voucherCode.updateMany.mockResolvedValue({ count: 2 });
      blockchainService.submitCouponTransfer.mockResolvedValue('0xUnknown');
      blockchainService.waitForCouponTransferReceipt.mockRejectedValue(
        new Error('RPC timeout'),
      );

      await expect(handler.execute(dto)).rejects.toThrow(
        InternalServerErrorException,
      );

      expect(prisma.voucherCode.updateMany).not.toHaveBeenCalledWith({
        where: { directTransferOperationId: 'operation-1' },
        data: { directTransferOperationId: null },
      });
      expect(prisma.directTransferOperation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'operation-1' },
          data: expect.objectContaining({ status: 'MANUAL_REVIEW' }),
        }),
      );
    });

    it('should mark DB_FAILED when confirmed codes no longer match the reservation', async () => {
      prisma.merchant.findUnique.mockResolvedValue(mockMerchant);
      prisma.customer.findUnique.mockResolvedValue(mockCustomer);
      prisma.voucher.findUnique.mockResolvedValue(mockVoucher);
      prisma.$queryRawUnsafe.mockResolvedValue(mockAvailableCodes);
      prisma.directTransferOperation.create.mockResolvedValue({
        id: 'operation-1',
      });
      prisma.voucherCode.updateMany
        .mockResolvedValueOnce({ count: 2 })
        .mockResolvedValueOnce({ count: 0 });
      blockchainService.submitCouponTransfer.mockResolvedValue('0xConfirmed');
      blockchainService.waitForCouponTransferReceipt.mockResolvedValue(
        undefined,
      );

      await expect(handler.execute(dto)).rejects.toThrow(
        InternalServerErrorException,
      );

      expect(prisma.transaction.create).not.toHaveBeenCalled();
      expect(prisma.directTransferOperation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'operation-1' },
          data: expect.objectContaining({ status: 'DB_FAILED' }),
        }),
      );
    });
  });
});
