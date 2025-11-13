-- AlterTable
ALTER TABLE "VoucherCode" ADD COLUMN     "voucherGroupId" TEXT;

-- CreateIndex
CREATE INDEX "VoucherCode_voucherGroupId_idx" ON "VoucherCode"("voucherGroupId");
