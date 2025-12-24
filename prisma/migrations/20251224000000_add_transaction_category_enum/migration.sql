-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('POINT', 'VOUCHER');

-- AlterTable: Add new 'type' column with AssetType enum
ALTER TABLE "Transaction" ADD COLUMN "type" "AssetType";

-- CreateIndex
CREATE INDEX "Transaction_type_idx" ON "Transaction"("type");

-- Populate type based on transactionTypeId
UPDATE "Transaction" SET "type" = 'POINT' WHERE "transactionTypeId" IN ('MINT', 'TRANSFER', 'BURN', 'EARN');
UPDATE "Transaction" SET "type" = 'VOUCHER' WHERE "transactionTypeId" IN ('REDEEM', 'MARKETPLACE_PURCHASE', 'MERCHANT_PURCHASE_FROM_SELLER', 'VOUCHER_TRANSFER', 'VOUCHER_GIFT');

-- Fallback: set type based on pointId or voucherCodeId
UPDATE "Transaction" SET "type" = 'POINT' WHERE "type" IS NULL AND "pointId" IS NOT NULL;
UPDATE "Transaction" SET "type" = 'VOUCHER' WHERE "type" IS NULL AND "voucherCodeId" IS NOT NULL;
