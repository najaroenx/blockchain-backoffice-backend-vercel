import { Merchant } from '@prisma/client';

export type GetMerchantsResponseType = {
  merchants: Merchant[];
  counts: number;
};

export type GetMerchantResponseType = {
  merchant: Merchant;
};

export type UpdateMerchantResponseType = {
  merchant: Merchant;
};
