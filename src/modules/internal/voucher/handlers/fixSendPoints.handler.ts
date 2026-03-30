import { Injectable, Logger } from '@nestjs/common';
import { CreateTransactionB2C } from 'src/modules/internal/transaction/handlers/createTransactionB2C.handler';

interface SendPointCustomer {
  phone: string;
  amount: number;
}

@Injectable()
export class FixSendPointsHandler {
  private logger = new Logger(FixSendPointsHandler.name);

  constructor(private readonly createTransactionB2C: CreateTransactionB2C) {}

  private isRetryableNonceError(errorMessage: string): boolean {
    return errorMessage.toLowerCase().includes('nonce');
  }

  /**
   * POST /fix/send-points
   * Send points to a list of customers via internal transaction API
   */
  async execute(
    merchantId: string,
    pointId: string,
    customers: SendPointCustomer[],
    dryRun: boolean = true,
  ) {
    const toSend = customers.filter((c) => c.amount > 0);
    const totalPoints = toSend.reduce((sum, c) => sum + c.amount, 0);

    this.logger.log(
      `Send points: ${toSend.length} customers, total ${totalPoints} pts, dryRun=${dryRun}`,
    );

    if (dryRun) {
      return {
        dryRun: true,
        merchantId,
        pointId,
        customersToSend: toSend.length,
        skipped: customers.length - toSend.length,
        totalPoints,
        customers: toSend.map((c) => ({
          phone: c.phone,
          amount: c.amount,
        })),
        message: `${toSend.length} customers, ${totalPoints} pts total. POST with dryRun=false to execute.`,
      };
    }

    // Execute mode — call transaction handler directly to avoid internal HTTP requests
    const results: {
      phone: string;
      amount: number;
      success: boolean;
      error?: string;
    }[] = [];

    for (let i = 0; i < toSend.length; i++) {
      const c = toSend[i];
      this.logger.log(
        `[${i + 1}/${toSend.length}] Sending ${c.amount} pts to ${c.phone}`,
      );

      let success = false;
      let lastError = '';

      // Retry up to 3 times for nonce errors
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await this.createTransactionB2C.execute(merchantId, pointId, {
            amount: c.amount,
            phone: c.phone,
            transactionTypeId: 'TRANSFER',
          });

          success = true;
          break;
        } catch (err: unknown) {
          lastError =
            err instanceof Error ? err.message : 'Unknown error occurred';

          if (this.isRetryableNonceError(lastError) && attempt < 3) {
            const delay = attempt * 5000;
            this.logger.warn(`Nonce error, retrying in ${delay / 1000}s...`);
            await new Promise((r) => setTimeout(r, delay));
            continue;
          }

          break;
        }
      }

      results.push({
        phone: c.phone,
        amount: c.amount,
        success,
        error: success ? undefined : lastError,
      });

      // Delay between requests to avoid nonce collision
      if (i < toSend.length - 1) {
        await new Promise((r) => setTimeout(r, 5000));
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    return {
      dryRun: false,
      merchantId,
      pointId,
      total: toSend.length,
      success: successCount,
      failed: failCount,
      totalPoints,
      results,
      message: `Sent to ${successCount}/${toSend.length} customers. Failed: ${failCount}.`,
    };
  }
}
