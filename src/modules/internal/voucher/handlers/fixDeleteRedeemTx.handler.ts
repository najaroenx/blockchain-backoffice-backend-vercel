import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class FixDeleteRedeemTxHandler {
  private logger = new Logger(FixDeleteRedeemTxHandler.name);

  constructor(private prisma: PrismaService) {}

  /**
   * POST /fix/delete-redeem-transactions/:merchantId
   * Delete REDEEM transactions from coupon redemptions
   */
  async execute(merchantId: string, dryRun: boolean = true) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { id: true, name: true },
    });
    if (!merchant) throw new NotFoundException(`Merchant ${merchantId} not found`);

    const vouchers = await this.prisma.voucher.findMany({
      where: { OR: [{ merchantId }, { sellerMerchantId: merchantId }] },
      select: { id: true, name: true },
    });
    const voucherIds = vouchers.map((v) => v.id);

    const redeemedCodes = await this.prisma.voucherCode.findMany({
      where: { voucherId: { in: voucherIds }, isUsed: true },
      include: { voucher: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const redeemedCodeIds = redeemedCodes.map((c) => c.id);

    // Find REDEEM transactions linked to redeemed codes
    const transactions = await this.prisma.transaction.findMany({
      where: {
        voucherCodeId: { in: redeemedCodeIds },
        transactionTypeId: 'REDEEM',
      },
      select: {
        id: true, transactionTypeId: true, type: true, amount: true,
        senderId: true, receiverId: true, senderType: true, receiverType: true,
        voucherCodeId: true, createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const txIds = transactions.map((t) => t.id);

    let deletedCount = 0;
    if (!dryRun && txIds.length > 0) {
      const result = await this.prisma.transaction.deleteMany({
        where: { id: { in: txIds } },
      });
      deletedCount = result.count;
      this.logger.log(`Deleted ${deletedCount} redeem transactions for merchant ${merchantId}`);
    }

    return {
      dryRun,
      merchant: { id: merchant.id, name: merchant.name },
      redeemedCodesCount: redeemedCodes.length,
      transactionsToDelete: txIds.length,
      deletedCount: dryRun ? 0 : deletedCount,
      voucherCodeChanges: 'NONE (isUsed, usedBy, usedAt untouched)',
      message: dryRun
        ? `Found ${txIds.length} REDEEM transactions. Use ?dryRun=false to delete.`
        : `Deleted ${deletedCount} REDEEM transactions. VoucherCodes untouched.`,
    };
  }
}
