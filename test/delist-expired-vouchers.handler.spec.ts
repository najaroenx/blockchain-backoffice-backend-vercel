jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));
jest.mock('src/libs/derive-wallet', () => ({
  getSignerFromSeedPhrase: jest.fn(() => ({ privateKey: '0xprivatekey' })),
}));

import { DelistExpiredVouchers } from 'src/modules/internal/voucher/handlers/delistExpiredVouchers.handler';
import { PrismaService } from 'prisma/prisma.service';
import { BlockchainService } from 'src/providers/blockchain/blockchain.service';
import { TokenService } from 'src/providers/token/token.service';
import { ConfigService } from '@nestjs/config';

describe('DelistExpiredVouchers', () => {
  let handler: DelistExpiredVouchers;
  let prisma: any;
  let blockchainService: any;
  let tokenService: any;
  let configService: any;

  beforeEach(() => {
    prisma = {
      voucherCode: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
      merchant: { findUnique: jest.fn() },
      voucher: { updateMany: jest.fn() },
    };
    blockchainService = { delistCoupon: jest.fn() };
    tokenService = { decryptKey: jest.fn() };
    configService = { get: jest.fn() };

    handler = new DelistExpiredVouchers(
      prisma as unknown as PrismaService,
      blockchainService as unknown as BlockchainService,
      tokenService as unknown as TokenService,
      configService as unknown as ConfigService,
    );
  });

  it('should return zeros when no expired listings found', async () => {
    prisma.voucherCode.findMany.mockResolvedValue([]);
    prisma.voucher.updateMany.mockResolvedValue({ count: 0 });

    const result = await handler.execute();

    expect(result).toEqual({
      processed: 0,
      delisted: 0,
      failed: 0,
      errors: [],
    });
  });

  it('should process expired listings and delist on blockchain', async () => {
    prisma.voucherCode.findMany.mockResolvedValue([
      {
        id: 'vc1',
        voucherGroupId: 'listing1',
        voucherId: 'v1',
        currentOwnerType: 'MERCHANT',
        currentOwnerId: 'm1',
        voucher: {
          id: 'v1',
          name: 'Voucher1',
          endDate: new Date('2020-01-01'),
          merchantId: 'm1',
        },
      },
    ]);
    prisma.merchant.findUnique.mockResolvedValue({
      id: 'm1',
      wallet: { seedPhrase: 'encrypted-seed', derivationIndex: 0 },
    });
    configService.get.mockReturnValue('salt123');
    tokenService.decryptKey.mockReturnValue('decrypted-seed');
    blockchainService.delistCoupon.mockResolvedValue({});
    prisma.voucherCode.updateMany.mockResolvedValue({ count: 1 });
    prisma.voucher.updateMany.mockResolvedValue({ count: 1 });

    const result = await handler.execute();

    expect(result.processed).toBe(1);
    expect(result.delisted).toBe(1);
    expect(result.failed).toBe(0);
    expect(blockchainService.delistCoupon).toHaveBeenCalledWith(
      'listing1',
      '0xprivatekey',
    );
  });

  it('should clear voucherGroupId even when no merchant wallet', async () => {
    prisma.voucherCode.findMany.mockResolvedValue([
      {
        id: 'vc1',
        voucherGroupId: 'listing1',
        voucherId: 'v1',
        currentOwnerType: 'MERCHANT',
        currentOwnerId: null,
        voucher: {
          id: 'v1',
          name: 'V1',
          endDate: new Date('2020-01-01'),
          merchantId: null,
        },
      },
    ]);
    prisma.voucherCode.updateMany.mockResolvedValue({ count: 1 });
    prisma.voucher.updateMany.mockResolvedValue({ count: 1 });

    const result = await handler.execute();

    expect(prisma.voucherCode.updateMany).toHaveBeenCalledWith({
      where: { voucherGroupId: 'listing1' },
      data: { voucherGroupId: null },
    });
    // processed=1 but null merchantId means skip + continue
    expect(result.processed).toBe(1);
  });

  it('should handle blockchain delist failure gracefully', async () => {
    prisma.voucherCode.findMany.mockResolvedValue([
      {
        id: 'vc1',
        voucherGroupId: 'listing1',
        voucherId: 'v1',
        currentOwnerType: 'MERCHANT',
        currentOwnerId: 'm1',
        voucher: {
          id: 'v1',
          name: 'V1',
          endDate: new Date('2020-01-01'),
          merchantId: 'm1',
        },
      },
    ]);
    prisma.merchant.findUnique.mockResolvedValue({
      id: 'm1',
      wallet: { seedPhrase: 'enc', derivationIndex: 0 },
    });
    configService.get.mockReturnValue('salt');
    tokenService.decryptKey.mockReturnValue('decrypted');
    blockchainService.delistCoupon.mockRejectedValue(
      new Error('blockchain fail'),
    );
    prisma.voucherCode.updateMany.mockResolvedValue({ count: 1 });
    prisma.voucher.updateMany.mockResolvedValue({ count: 1 });

    const result = await handler.execute();

    // Blockchain fails but DB update still happens
    expect(result.delisted).toBe(1);
    expect(prisma.voucherCode.updateMany).toHaveBeenCalled();
  });

  it('should update expired vouchers with no listings', async () => {
    prisma.voucherCode.findMany.mockResolvedValue([]);
    prisma.voucher.updateMany.mockResolvedValue({ count: 3 });

    const result = await handler.execute();

    expect(prisma.voucher.updateMany).toHaveBeenCalled();
    expect(result.processed).toBe(0);
  });

  it('should throw on fatal error', async () => {
    prisma.voucherCode.findMany.mockRejectedValue(new Error('DB down'));

    await expect(handler.execute()).rejects.toThrow('DB down');
  });
});
