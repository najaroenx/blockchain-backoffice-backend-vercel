/**
 * Transaction Type Enum
 * These IDs match the TransactionType records in the database
 * Use these constants when creating transactions to ensure consistency
 */
export enum TransactionTypeId {
  // Point-related transactions
  MINT = 'MINT',
  TRANSFER = 'TRANSFER',
  BURN = 'BURN',
  EARN = 'EARN',
  REDEEM = 'REDEEM',

  // Voucher-related transactions
  MARKETPLACE_PURCHASE = 'MARKETPLACE_PURCHASE',
  MERCHANT_PURCHASE_FROM_SELLER = 'MERCHANT_PURCHASE_FROM_SELLER',
  VOUCHER_TRANSFER = 'VOUCHER_TRANSFER',
  VOUCHER_GIFT = 'VOUCHER_GIFT',
}
