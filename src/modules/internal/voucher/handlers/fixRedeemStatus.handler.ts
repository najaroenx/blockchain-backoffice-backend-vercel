import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class FixRedeemStatusHandler {
  private logger = new Logger(FixRedeemStatusHandler.name);

  constructor(private prisma: PrismaService) {}

  /**
   * GET /fix/redeem-status/:merchantId
   * Query unredeemed/redeemed coupon status for a merchant
   */
  async execute(merchantId: string) {
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

    const customerIds = [
      ...new Set(
        soldCodes.map((c) => c.usedBy || c.currentOwnerId).filter(Boolean),
      ),
    ] as string[];

    const customers = await this.prisma.customer.findMany({
      where: { id: { in: customerIds } },
      select: { id: true, tel: true, firstName: true, lastName: true },
    });
    const customerMap = new Map(customers.map((c) => [c.id, c]));

    const redeemed = soldCodes.filter((c) => c.isUsed);
    const unredeemed = soldCodes.filter((c) => !c.isUsed);

    return {
      merchant: { id: merchant.id, name: merchant.name },
      vouchersCount: vouchers.length,
      totalSold: soldCodes.length,
      unredeemedCount: unredeemed.length,
      redeemedCount: redeemed.length,
      unredeemed: unredeemed.map((c) => {
        const cust = customerMap.get(c.currentOwnerId || '');
        return {
          code: c.code,
          voucherName: c.voucher?.name,
          ownerPhone: cust?.tel || c.currentOwnerId,
          ownerType: c.currentOwnerType,
          createdAt: c.createdAt,
        };
      }),
      redeemed: redeemed.map((c) => {
        const cust = customerMap.get(c.usedBy || '');
        return {
          code: c.code,
          voucherName: c.voucher?.name,
          usedByPhone: cust?.tel || c.usedBy,
          ownerType: c.currentOwnerType,
          usedAt: c.usedAt,
        };
      }),
    };
  }
}
