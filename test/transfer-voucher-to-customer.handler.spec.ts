jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));
jest.mock('src/libs/derive-wallet', () => ({
  getSignerFromSeedPhrase: jest.fn().mockReturnValue({ privateKey: '0xMerchantKey' }),
}));
jest.mock('src/libs/convertBufferToAddress', () => ({
  convertBufferToAddress: jest.fn((buf) => '0x' + Buffer.from(buf || []).toString('hex')),
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
      $queryRawUnsafe: jest.fn(),
      $transaction: jest.fn(),
    };
    blockchainService = { transferCoupon: jest.fn() };
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
      prisma.merchant.findUnique.mockResolvedValue({ id: 'merchant-1', wallet: null });

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
      prisma.$queryRawUnsafe.mockResolvedValue([{ id: 'code-1', code: 'X' }]);

      await expect(handler.execute(dto)).rejects.toThrow(BadRequestException);
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
      blockchainService.transferCoupon.mockResolvedValue(txHash);
      prisma.$transaction.mockImplementation(async (fn: any) => fn(prisma));
      prisma.voucherCode = { updateMany: jest.fn() };
      prisma.transaction = { create: jest.fn() };
      prisma.voucherCode.updateMany.mockResolvedValue({});
      prisma.transaction.create
        .mockResolvedValueOnce(mockTransactions[0])
        .mockResolvedValueOnce(mockTransactions[1]);
    });

    it('should return success response with transactionHash', async () => {
      const result = await handler.execute(dto);

      expect(result.message).toBe('Voucher transfer successful');
      expect(result.transactionHash).toBe(txHash);
      expect(result.transferredQuantity).toBe(2);
      expect(result.voucherCodeIds).toEqual(['code-1', 'code-2']);
    });

    it('should call blockchainService.transferCoupon with correct args', async () => {
      await handler.execute(dto);

      expect(blockchainService.transferCoupon).toHaveBeenCalledWith(
        42,
        2,
        '0xMerchantAddr',
        '0xCustomerAddr',
        '0xMerchantKey',
      );
    });

    it('should use default quantity of 1 when not provided', async () => {
      const dtoNoQty = { merchantId: 'merchant-1', customerPhone: '0812345678', voucherId: 'voucher-1' };
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
      prisma.merchant.findUnique.mockRejectedValue(new NotFoundException('not found'));

      await expect(handler.execute(dto)).rejects.toThrow(NotFoundException);
    });

    it('should wrap unexpected errors in InternalServerErrorException', async () => {
      prisma.merchant.findUnique.mockRejectedValue(new Error('DB crash'));

      await expect(handler.execute(dto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
