/*
  Warnings:

  - You are about to drop the column `isActive` on the `VoucherCode` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."VoucherCode_voucherId_isActive_idx";

-- AlterTable
ALTER TABLE "VoucherCode" DROP COLUMN "isActive";
