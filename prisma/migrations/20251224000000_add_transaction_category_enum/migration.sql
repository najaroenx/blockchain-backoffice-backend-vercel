-- CreateEnum
CREATE TYPE "TransactionCategory" AS ENUM ('POINT', 'VOUCHER');

-- AlterTable: Remove old 'type' column and add new 'category' column
ALTER TABLE "Transaction" DROP COLUMN IF EXISTS "type";
ALTER TABLE "Transaction" ADD COLUMN "category" "TransactionCategory";

-- CreateIndex
CREATE INDEX "Transaction_category_idx" ON "Transaction"("category");

-- Populate category based on transactionTypeId
UPDATE "Transaction" SET "category" = 'POINT' WHERE "transactionTypeId" IN ('MINT', 'TRANSFER', 'BURN', 'EARN');
UPDATE "Transaction" SET "category" = 'VOUCHER' WHERE "transactionTypeId" IN ('REDEEM', 'MARKETPLACE_PURCHASE', 'MERCHANT_PURCHASE_FROM_SELLER', 'VOUCHER_TRANSFER', 'VOUCHER_GIFT');

-- Fallback: set category based on pointId or voucherCodeId
UPDATE "Transaction" SET "category" = 'POINT' WHERE "category" IS NULL AND "pointId" IS NOT NULL;
UPDATE "Transaction" SET "category" = 'VOUCHER' WHERE "category" IS NULL AND "voucherCodeId" IS NOT NULL;
