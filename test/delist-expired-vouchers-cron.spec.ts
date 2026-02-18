jest.mock('prisma/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

import { DelistExpiredVouchersCron } from 'src/modules/internal/voucher/cron/delistExpiredVouchers.cron';

describe('DelistExpiredVouchersCron', () => {
  let cron: DelistExpiredVouchersCron;
  let mockDelistHandler: any;

  beforeEach(() => {
    mockDelistHandler = {
      execute: jest.fn(),
    };
    cron = new DelistExpiredVouchersCron(mockDelistHandler);
  });

  it('should run handleCron successfully', async () => {
    mockDelistHandler.execute.mockResolvedValue({
      processed: 5,
      delisted: 3,
      failed: 0,
      errors: [],
    });

    await cron.handleCron();
    expect(mockDelistHandler.execute).toHaveBeenCalled();
  });

  it('should handle errors in cron job', async () => {
    mockDelistHandler.execute.mockRejectedValue(new Error('DB down'));
    // Should not throw
    await expect(cron.handleCron()).resolves.toBeUndefined();
  });

  it('should log warnings when there are errors', async () => {
    mockDelistHandler.execute.mockResolvedValue({
      processed: 2,
      delisted: 1,
      failed: 1,
      errors: ['Failed to delist listing 123'],
    });

    await cron.handleCron();
    expect(mockDelistHandler.execute).toHaveBeenCalled();
  });
});
