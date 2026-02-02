import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DelistExpiredVouchers } from '../handlers/delistExpiredVouchers.handler';

@Injectable()
export class DelistExpiredVouchersCron {
  private logger = new Logger(DelistExpiredVouchersCron.name);

  constructor(private delistExpiredVouchers: DelistExpiredVouchers) {}

  // Run every 12 hours at minute 0 (00:00 and 12:00)
  @Cron('0 0 */12 * * *')
  async handleCron() {
    this.logger.log('[CRON] Starting delist expired vouchers job...');

    try {
      const result = await this.delistExpiredVouchers.execute();

      this.logger.log(
        `[CRON] Job completed. Processed: ${result.processed}, Delisted: ${result.delisted}, Failed: ${result.failed}`,
      );

      if (result.errors.length > 0) {
        this.logger.warn(`[CRON] Errors: ${result.errors.join(', ')}`);
      }
    } catch (error) {
      this.logger.error(`[CRON] Job failed: ${error.message}`, error.stack);
    }
  }
}
