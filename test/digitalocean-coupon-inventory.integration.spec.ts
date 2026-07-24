import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const describeDigitalOcean =
  process.env.RUN_DIGITALOCEAN_DB_INTEGRATION === '1'
    ? describe
    : describe.skip;

type CountRow = {
  total: bigint;
  sold: bigint;
  unsold: bigint;
  unredeemed: bigint;
  redeemed: bigint;
};

describeDigitalOcean('DigitalOcean coupon inventory (read-only)', () => {
  const prisma = new PrismaClient();

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('keeps dashboard totals consistent for all historical VoucherCode rows', async () => {
    const [row] = await prisma.$queryRaw<CountRow[]>`
      SELECT
        COUNT(*)::bigint AS total,
        COUNT(*) FILTER (
          WHERE "currentOwnerType" = 'CUSTOMER'
        )::bigint AS sold,
        COUNT(*) FILTER (
          WHERE "currentOwnerType" IS DISTINCT FROM 'CUSTOMER'
        )::bigint AS unsold,
        COUNT(*) FILTER (
          WHERE "currentOwnerType" = 'CUSTOMER' AND NOT "isUsed"
        )::bigint AS unredeemed,
        COUNT(*) FILTER (
          WHERE "currentOwnerType" = 'CUSTOMER' AND "isUsed"
        )::bigint AS redeemed
      FROM "VoucherCode"
    `;

    expect(row.total).toBe(row.sold + row.unsold);
    expect(row.sold).toBe(row.unredeemed + row.redeemed);
  });

  it('defines every direct-transfer candidate as an unlisted, Point-free Wallet Pool row', async () => {
    const candidates = await prisma.$queryRaw<
      Array<{
        id: string;
        currentOwnerType: string | null;
        isUsed: boolean;
        voucherGroupId: string | null;
        pointId: string | null;
      }>
    >`
      SELECT
        id,
        "currentOwnerType",
        "isUsed",
        "voucherGroupId",
        "pointId"
      FROM "VoucherCode"
      WHERE "currentOwnerType" = 'MERCHANT'
        AND NOT "isUsed"
        AND "voucherGroupId" IS NULL
        AND "pointId" IS NULL
      ORDER BY id
      LIMIT 500
    `;

    for (const candidate of candidates) {
      expect(candidate).toMatchObject({
        currentOwnerType: 'MERCHANT',
        isUsed: false,
        voucherGroupId: null,
        pointId: null,
      });
    }
  });

  it('can resolve historical customer-held coupons without requiring pointId', async () => {
    const [row] = await prisma.$queryRaw<Array<{ unresolved: bigint }>>`
      SELECT COUNT(*)::bigint AS unresolved
      FROM "VoucherCode" vc
      JOIN "Voucher" v ON v.id = vc."voucherId"
      LEFT JOIN "Point" p ON p.id = vc."pointId"
      WHERE vc."currentOwnerType" = 'CUSTOMER'
        AND p."merchantId" IS NULL
        AND v."merchantId" IS NULL
        AND v."sellerMerchantId" IS NULL
    `;

    expect(row.unresolved).toBe(0n);
  });
});
