/**
 * Transaction Type Enum
 * These IDs match the TransactionType records in the database
 * Use these constants when creating transactions to ensure consistency
 *
 * New structure (2026):
 * - TRANSFER is now used for both POINT and VOUCHER transactions
 * - Use the `type` field (AssetType) to distinguish between POINT and VOUCHER
 * - type=POINT + enum=TRANSFER: Point transfer (replaces MARKETPLACE_PURCHASE)
 * - type=VOUCHER + enum=TRANSFER: Voucher transfer (replaces VOUCHER_TRANSFER, VOUCHER_GIFT)
 */
export enum TransactionTypeId {
  // Core transaction type (used for both POINT and VOUCHER)
  TRANSFER = 'TRANSFER',

  // Point-only transactions
  MINT = 'MINT',
  BURN = 'BURN',
  EARN = 'EARN',

  // Voucher-only transactions
  REDEEM = 'REDEEM',
  MERCHANT_PURCHASE_FROM_SELLER = 'MERCHANT_PURCHASE_FROM_SELLER',

  /** @deprecated Use TRANSFER with type=POINT instead. Kept for backward compatibility */
  MARKETPLACE_PURCHASE = 'MARKETPLACE_PURCHASE',
  /** @deprecated Use TRANSFER with type=VOUCHER instead. Kept for backward compatibility */
  VOUCHER_TRANSFER = 'VOUCHER_TRANSFER',
  /** @deprecated Use TRANSFER with type=VOUCHER instead. Kept for backward compatibility */
  VOUCHER_GIFT = 'VOUCHER_GIFT',
}

/**
 * Asset Type Enum
 * High-level classification of transactions
 * - POINT: Point-related transactions (mint, transfer, burn, earn)
 * - VOUCHER: Voucher-related transactions (transfer, redeem)
 *
 * Important: TRANSFER enum can be either POINT or VOUCHER based on `type` field
 */
export { AssetType } from '@prisma/client';

/**
 * Mapping from TransactionTypeId to default AssetType
 * Note: TRANSFER defaults to POINT, but can be VOUCHER based on `type` field in transaction
 */
export const TRANSACTION_TYPE_TO_ASSET_TYPE: Record<
  TransactionTypeId,
  'POINT' | 'VOUCHER'
> = {
  // Core - defaults to POINT but check `type` field for actual value
  [TransactionTypeId.TRANSFER]: 'POINT',

  // Point-only
  [TransactionTypeId.MINT]: 'POINT',
  [TransactionTypeId.BURN]: 'POINT',
  [TransactionTypeId.EARN]: 'POINT',

  // Voucher-only
  [TransactionTypeId.REDEEM]: 'VOUCHER',
  [TransactionTypeId.MERCHANT_PURCHASE_FROM_SELLER]: 'VOUCHER',

  // Deprecated - kept for backward compatibility
  [TransactionTypeId.MARKETPLACE_PURCHASE]: 'POINT',
  [TransactionTypeId.VOUCHER_TRANSFER]: 'VOUCHER',
  [TransactionTypeId.VOUCHER_GIFT]: 'VOUCHER',
};
