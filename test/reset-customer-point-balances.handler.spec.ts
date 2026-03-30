jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import { InternalServerErrorException } from '@nestjs/common';
import { ResetCustomerPointBalances } from 'src/modules/internal/admin/handlers/reset-customer-point-balances.handler';

describe('ResetCustomerPointBalances', () => {
  let handler: ResetCustomerPointBalances;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      customerPoint: {
        updateMany: jest.fn(),
      },
    };

    handler = new ResetCustomerPointBalances(prisma);
  });

  it('should reset all balances to 0 and return updated count', async () => {
    prisma.customerPoint.updateMany.mockResolvedValue({ count: 12 });

    const result = await handler.execute();

    expect(prisma.customerPoint.updateMany).toHaveBeenCalledWith({
      data: { balances: 0 },
    });
    expect(result).toEqual({
      success: true,
      message: 'All customerPoint balances have been reset to 0',
      updatedCount: 12,
    });
  });

  it('should throw InternalServerErrorException on update failure', async () => {
    prisma.customerPoint.updateMany.mockRejectedValue(new Error('db error'));

    await expect(handler.execute()).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });
});
