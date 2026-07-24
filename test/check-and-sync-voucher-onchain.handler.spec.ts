import { BadRequestException } from '@nestjs/common';
import { CheckAndSyncVoucherOnchainHandler } from '../src/modules/internal/voucher/handlers/checkAndSyncVoucherOnchain.handler';

describe('CheckAndSyncVoucherOnchainHandler mutation guard', () => {
  const createHandler = () => {
    const prisma = {
      voucher: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      merchant: {
        findUnique: jest.fn(),
      },
    };
    const blockchainService = {};
    const configService = { get: jest.fn() };

    return {
      handler: new CheckAndSyncVoucherOnchainHandler(
        prisma as any,
        blockchainService as any,
        configService as any,
      ),
      prisma,
      configService,
    };
  };

  it.each([
    ['sync', true, false],
    ['fixOnchain', false, true],
    ['both flags', true, true],
  ])(
    'rejects %s before querying the database or blockchain',
    async (_label, syncFlag, fixOnchainFlag) => {
      const { handler, prisma, configService } = createHandler();

      const exception = await handler
        .execute('voucher-1', syncFlag, fixOnchainFlag)
        .catch((error) => error);

      expect(exception).toBeInstanceOf(BadRequestException);
      expect(exception.getResponse()).toMatchObject({
        statusCode: 400,
        code: 'AUTOMATIC_RECONCILIATION_DISABLED',
      });
      expect(prisma.voucher.findUnique).not.toHaveBeenCalled();
      expect(configService.get).not.toHaveBeenCalled();
    },
  );

  it('rejects merchant-wide mutation before querying the merchant', async () => {
    const { handler, prisma } = createHandler();

    await expect(
      handler.executeForMerchant('merchant-1', true, false),
    ).rejects.toMatchObject({
      response: {
        code: 'AUTOMATIC_RECONCILIATION_DISABLED',
      },
    });

    expect(prisma.merchant.findUnique).not.toHaveBeenCalled();
  });
});
