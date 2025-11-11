/*
  Warnings:

  - You are about to drop the column `voucherId` on the `Transaction` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."Transaction" DROP CONSTRAINT "Transaction_voucherId_fkey";

-- AlterTable
ALTER TABLE "Transaction" DROP COLUMN "voucherId";

-- CreateTable
CREATE TABLE "VoucherCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "voucherId" TEXT NOT NULL,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "usedBy" TEXT,
    "usedAt" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoucherCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VoucherCode_code_key" ON "VoucherCode"("code");

-- CreateIndex
CREATE INDEX "VoucherCode_voucherId_isUsed_idx" ON "VoucherCode"("voucherId", "isUsed");

-- CreateIndex
CREATE INDEX "VoucherCode_code_idx" ON "VoucherCode"("code");

-- AddForeignKey
ALTER TABLE "VoucherCode" ADD CONSTRAINT "VoucherCode_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "Voucher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
