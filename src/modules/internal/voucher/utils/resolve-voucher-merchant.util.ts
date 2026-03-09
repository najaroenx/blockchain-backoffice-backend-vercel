type VoucherMerchantLike = {
  merchantId?: string | null;
  sellerMerchantId?: string | null;
  merchant?: {
    id?: string | null;
    name?: string | null;
    imageUrl?: string | null;
    description?: string | null;
  } | null;
  merchantName?: string | null;
};

export function resolveVoucherMerchantId(
  voucher?: VoucherMerchantLike | null,
): string | null {
  if (!voucher) {
    return null;
  }

  return (
    voucher.merchantId ||
    voucher.sellerMerchantId ||
    voucher.merchant?.id ||
    null
  );
}

export function resolveVoucherMerchantName(
  voucher?: VoucherMerchantLike | null,
): string | null {
  if (!voucher) {
    return null;
  }

  return voucher.merchant?.name || voucher.merchantName || null;
}
