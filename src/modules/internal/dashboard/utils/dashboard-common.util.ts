import { endOfDay, format, startOfDay, startOfMonth } from 'date-fns';
import { PrismaService } from 'prisma/prisma.service';
import { DashboardQueryDto } from '../dtos/dashboard-query.dto';
import {
  CouponDropdownResponse,
  DateRangeInfo,
} from '../types/dashboard.types';

type CouponWithMerchantRef = {
  id: string;
  name: string;
  merchantRef: string | null;
};

export function parseDashboardDateRange(
  query: DashboardQueryDto,
): DateRangeInfo {
  const now = new Date();
  const startDate = query.startDate
    ? startOfDay(new Date(query.startDate))
    : startOfMonth(now);
  const endDate = query.endDate
    ? endOfDay(new Date(query.endDate))
    : endOfDay(now);

  return {
    startDate: format(startDate, 'yyyy-MM-dd'),
    endDate: format(endDate, 'yyyy-MM-dd'),
  };
}

export async function attachMerchantRefNames(
  prisma: PrismaService,
  vouchers: CouponWithMerchantRef[],
): Promise<CouponDropdownResponse['coupons']> {
  const merchantRefs = [
    ...new Set(vouchers.map((voucher) => voucher.merchantRef).filter(Boolean)),
  ];

  if (merchantRefs.length === 0) {
    return vouchers.map((voucher) => ({
      ...voucher,
      merchantRefName: null,
    }));
  }

  const merchantRefStores = await prisma.merchantRefStore.findMany({
    where: {
      merchantRef: { in: merchantRefs },
    },
    select: {
      merchantRef: true,
      name: true,
    },
  });

  const merchantRefNameMap = new Map(
    merchantRefStores.map((store) => [store.merchantRef, store.name]),
  );

  return vouchers.map((voucher) => ({
    ...voucher,
    merchantRefName: voucher.merchantRef
      ? (merchantRefNameMap.get(voucher.merchantRef) ?? null)
      : null,
  }));
}
