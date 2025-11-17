-- AlterTable
ALTER TABLE "VoucherCode" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "VoucherCode_voucherId_isActive_idx" ON "VoucherCode"("voucherId", "isActive");
