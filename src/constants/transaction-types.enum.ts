/**
 * Transaction Type Enum
 * These IDs match the TransactionType records in the database
 * Use these constants when creating transactions to ensure consistency
 *
 * Structure:
 * - TRANSFER is used for both POINT and VOUCHER transactions
 * - Use the `type` field (AssetType) to distinguish between POINT and VOUCHER
 * - type=POINT + TRANSFER: Point transfer between wallets
 * - type=VOUCHER + TRANSFER: Voucher transfer (merchant buy from seller, etc.)
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

  // THB Token transactions
  THB_MINT = 'THB_MINT', // Auto-mint THB for merchant
  THB_BUY = 'THB_BUY', // Merchant buy voucher from seller using THB
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
  'POINT' | 'VOUCHER' | 'THB_TOKEN'
> = {
  // Core - defaults to POINT but check `type` field for actual value
  [TransactionTypeId.TRANSFER]: 'POINT',

  // Point-only
  [TransactionTypeId.MINT]: 'POINT',
  [TransactionTypeId.BURN]: 'POINT',
  [TransactionTypeId.EARN]: 'POINT',

  // Voucher-only
  [TransactionTypeId.REDEEM]: 'VOUCHER',

  // THB Token
  [TransactionTypeId.THB_MINT]: 'THB_TOKEN',
  [TransactionTypeId.THB_BUY]: 'THB_TOKEN',
};
