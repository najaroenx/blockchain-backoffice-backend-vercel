import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class FixDeletePurchaseTxHandler {
  private logger = new Logger(FixDeletePurchaseTxHandler.name);

  constructor(private prisma: PrismaService) {}

  /**
   * POST /fix/delete-purchase-transactions/:merchantId
   * Delete TRANSFER transactions from coupon purchases
   */
  async execute(merchantId: string, dryRun: boolean = true) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { id: true, name: true },
    });
    if (!merchant)
      throw new NotFoundException(`Merchant ${merchantId} not found`);

    const vouchers = await this.prisma.voucher.findMany({
      where: { OR: [{ merchantId }, { sellerMerchantId: merchantId }] },
      select: { id: true, name: true },
    });
    const voucherIds = vouchers.map((v) => v.id);

    const soldCodes = await this.prisma.voucherCode.findMany({
      where: {
        voucherId: { in: voucherIds },
        OR: [{ currentOwnerType: 'CUSTOMER' }, { isUsed: true }],
      },
      include: { voucher: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const soldCodeIds = soldCodes.map((c) => c.id);
    const redeemed = soldCodes.filter((c) => c.isUsed);
    const unredeemed = soldCodes.filter((c) => !c.isUsed);

    // Find TRANSFER transactions linked to sold codes
    const transactions = await this.prisma.transaction.findMany({
      where: {
        voucherCodeId: { in: soldCodeIds },
        transactionTypeId: 'TRANSFER',
      },
      select: {
        id: true,
        transactionTypeId: true,
        type: true,
        amount: true,
        senderId: true,
        receiverId: true,
        senderType: true,
        receiverType: true,
        voucherCodeId: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const txIds = transactions.map((t) => t.id);
    const pointTx = transactions.filter((t) => t.type === 'POINT');
    const voucherTx = transactions.filter((t) => t.type === 'VOUCHER');

    let deletedCount = 0;
    if (!dryRun && txIds.length > 0) {
      const result = await this.prisma.transaction.deleteMany({
        where: { id: { in: txIds } },
      });
      deletedCount = result.count;
      this.logger.log(
        `Deleted ${deletedCount} purchase transactions for merchant ${merchantId}`,
      );
    }

    return {
      dryRun,
      merchant: { id: merchant.id, name: merchant.name },
      soldCodesCount: soldCodes.length,
      unredeemedCount: unredeemed.length,
      redeemedCount: redeemed.length,
      transactionsToDelete: txIds.length,
      breakdown: {
        transferPoint: pointTx.length,
        transferVoucher: voucherTx.length,
      },
      deletedCount: dryRun ? 0 : deletedCount,
      voucherCodeChanges: 'NONE',
      message: dryRun
        ? `Found ${txIds.length} TRANSFER transactions. Use ?dryRun=false to delete.`
        : `Deleted ${deletedCount} TRANSFER transactions. VoucherCodes untouched.`,
    };
  }
}
