import { Merchant } from '@prisma/client';

export type GetMerchantsResponseType = {
  merchants: Merchant[];
  counts: number;
};
