import { GroupedVoucher } from 'src/modules/internal/customer/types';

export type CustomerOwnedVoucherMerchant = {
  id: string | undefined;
  name: string | undefined;
  imageUrl: string | null | undefined;
};

export type CustomerOwnedVoucherInfo = {
  id: string;
  tokenId: string | null;
  name: string;
  description: string | null;
  valueType: string;
  value: number;
  currency: string | null;
  imageUrl: string | null;
  startDate: Date | null;
  endDate: Date | null;
  merchantRef: string | null;
};

export type CustomerOwnedVoucherItem = {
  codeId: string | null;
  code: string | null;
  isUsed: boolean;
  usedAt: Date | null;
  pointsCost: number;
  currency: string;
  receivedAt: Date | null;
  transactionTypeId: string | null;
  onChainBalance: string;
  voucher: CustomerOwnedVoucherInfo;
  merchant: CustomerOwnedVoucherMerchant;
};

export type CustomerOwnedVouchersPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type CustomerOwnedVouchersSummary = {
  total: number;
  unused: number;
  used: number;
};

export type GetCustomerOwnedVouchersResponseType = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  status: 'unused' | 'used' | 'all';
  summary: CustomerOwnedVouchersSummary;
  vouchers: GroupedVoucher[];
};
