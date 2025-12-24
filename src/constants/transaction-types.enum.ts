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

/**
 * Transaction Category Enum
 * High-level classification of transactions
 * - POINT: Point-related transactions (mint, transfer, burn, earn)
 * - VOUCHER: Voucher-related transactions (purchase, redeem, transfer)
 */
export { TransactionCategory } from '@prisma/client';

/**
 * Mapping from TransactionTypeId to TransactionCategory
 */
export const TRANSACTION_TYPE_TO_CATEGORY: Record<
  TransactionTypeId,
  'POINT' | 'VOUCHER'
> = {
  [TransactionTypeId.MINT]: 'POINT',
  [TransactionTypeId.TRANSFER]: 'POINT',
  [TransactionTypeId.BURN]: 'POINT',
  [TransactionTypeId.EARN]: 'POINT',
  [TransactionTypeId.REDEEM]: 'VOUCHER',
  [TransactionTypeId.MARKETPLACE_PURCHASE]: 'VOUCHER',
  [TransactionTypeId.MERCHANT_PURCHASE_FROM_SELLER]: 'VOUCHER',
  [TransactionTypeId.VOUCHER_TRANSFER]: 'VOUCHER',
  [TransactionTypeId.VOUCHER_GIFT]: 'VOUCHER',
};
