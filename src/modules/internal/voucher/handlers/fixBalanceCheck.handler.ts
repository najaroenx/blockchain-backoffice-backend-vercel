import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class FixBalanceCheckHandler {
  private logger = new Logger(FixBalanceCheckHandler.name);

  constructor(private prisma: PrismaService) {}

  /**
   * GET /fix/balance-check/:merchantId
   * Check customer point balances before/after coupon purchase
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
      include: { voucher: { select: { name: true, merchantRef: true } } },
      orderBy: { createdAt: 'desc' },
    });

    if (soldCodes.length === 0) {
      return {
        merchant: { id: merchant.id, name: merchant.name },
        customers: [],
        totalSold: 0,
      };
    }

    // Aggregate pointsCost per customer+pointId
    const spendMap = new Map<
      string,
      {
        customerId: string;
        pointId: string;
        totalSpent: number;
        codes: typeof soldCodes;
        isBug: boolean;
      }
    >();

    for (const code of soldCodes) {
      const customerId = code.currentOwnerId || code.usedBy;
      const pointId = code.pointId;
      if (!customerId || !pointId) continue;

      const isBug = code.currentOwnerType !== 'CUSTOMER';
      const key = `${customerId}:${pointId}`;
      const entry = spendMap.get(key) || {
        customerId,
        pointId,
        totalSpent: 0,
        codes: [] as typeof soldCodes,
        isBug,
      };
      if (isBug) entry.isBug = true;
      entry.totalSpent += code.pointsCost;
      entry.codes.push(code);
      spendMap.set(key, entry);
    }

    const customerIds = [
      ...new Set([...spendMap.values()].map((e) => e.customerId)),
    ];
    const pointIds = [...new Set([...spendMap.values()].map((e) => e.pointId))];

    const [customers, points] = await Promise.all([
      this.prisma.customer.findMany({
        where: { id: { in: customerIds } },
        select: { id: true, tel: true, firstName: true, lastName: true },
      }),
      this.prisma.point.findMany({
        where: { id: { in: pointIds } },
        select: { id: true, name: true, symbol: true },
      }),
    ]);

    const custMap = new Map(customers.map((c) => [c.id, c]));
    const pointMap = new Map(points.map((p) => [p.id, p]));

    // Calculate balances from Transaction table
    const soldCodeIds = new Set(soldCodes.map((c) => c.id));

    const allTx = await this.prisma.transaction.findMany({
      where: {
        type: 'POINT',
        pointId: { in: pointIds },
        OR: [
          { senderId: { in: customerIds }, senderType: 'CUSTOMER' },
          { receiverId: { in: customerIds }, receiverType: 'CUSTOMER' },
        ],
      },
      select: {
        amount: true,
        pointId: true,
        senderId: true,
        senderType: true,
        receiverId: true,
        receiverType: true,
        voucherCodeId: true,
        transactionTypeId: true,
      },
    });

    const txBalanceAll = new Map<string, number>();
    const txBalanceExcPurchase = new Map<string, number>();

    for (const tx of allTx) {
      const isPurchaseTx =
        tx.senderType === 'CUSTOMER' &&
        tx.transactionTypeId === 'TRANSFER' &&
        tx.voucherCodeId &&
        soldCodeIds.has(tx.voucherCodeId);

      if (tx.receiverType === 'CUSTOMER' && tx.receiverId && tx.pointId) {
        const key = `${tx.receiverId}:${tx.pointId}`;
        txBalanceAll.set(key, (txBalanceAll.get(key) || 0) + tx.amount);
        if (!isPurchaseTx) {
          txBalanceExcPurchase.set(
            key,
            (txBalanceExcPurchase.get(key) || 0) + tx.amount,
          );
        }
      }
      if (tx.senderType === 'CUSTOMER' && tx.senderId && tx.pointId) {
        const key = `${tx.senderId}:${tx.pointId}`;
        txBalanceAll.set(key, (txBalanceAll.get(key) || 0) - tx.amount);
        if (!isPurchaseTx) {
          txBalanceExcPurchase.set(
            key,
            (txBalanceExcPurchase.get(key) || 0) - tx.amount,
          );
        }
      }
    }

    // Merchant ref store names
    const merchantRefs = [
      ...new Set(soldCodes.map((c) => c.voucher?.merchantRef).filter(Boolean)),
    ] as string[];
    const refStores =
      merchantRefs.length > 0
        ? await this.prisma.merchantRefStore.findMany({
            where: { merchantRef: { in: merchantRefs } },
            select: { merchantRef: true, name: true },
          })
        : [];
    const refStoreMap = new Map(refStores.map((s) => [s.merchantRef, s.name]));

    // Build result rows
    const rows = [...spendMap.entries()].map(([key, entry]) => {
      const cust = custMap.get(entry.customerId);
      const point = pointMap.get(entry.pointId);
      const before = txBalanceExcPurchase.get(key) || 0;
      const after = txBalanceAll.get(key) || 0;
      const expectedAfter = before - entry.totalSpent;

      const merchantRefSet = [
        ...new Set(
          entry.codes.map((c) => c.voucher?.merchantRef).filter(Boolean),
        ),
      ] as string[];
      const storeName =
        merchantRefSet.map((ref) => refStoreMap.get(ref) || ref).join(', ') ||
        '-';

      const nameCount = new Map<string, number>();
      for (const c of entry.codes) {
        const vName = c.voucher?.name || 'N/A';
        nameCount.set(vName, (nameCount.get(vName) || 0) + 1);
      }
      const couponNames = [...nameCount.entries()]
        .map(([n, cnt]) => (cnt > 1 ? `${n} x${cnt}` : n))
        .join(', ');

      return {
        phone: cust?.tel || entry.customerId,
        storeName,
        pointName: point ? `${point.name} (${point.symbol})` : entry.pointId,
        before,
        totalSpent: entry.totalSpent,
        after,
        expectedAfter,
        isCorrect: after === expectedAfter,
        diff: after - expectedAfter,
        couponsCount: entry.codes.length,
        couponNames,
        isBug: entry.isBug,
      };
    });

    rows.sort((a, b) => b.totalSpent - a.totalSpent);

    const sumSpent = rows.reduce((s, r) => s + r.totalSpent, 0);
    const allCorrect = rows.every((r) => r.isCorrect);

    return {
      merchant: { id: merchant.id, name: merchant.name },
      totalSold: soldCodes.length,
      customersCount: rows.length,
      totalPointsSpent: sumSpent,
      allBalancesCorrect: allCorrect,
      customers: rows,
    };
  }
}
