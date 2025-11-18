-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "voucherCodeId" TEXT;

-- AlterTable
ALTER TABLE "VoucherCode" ADD COLUMN     "currentOwnerId" TEXT;

-- CreateIndex
CREATE INDEX "Transaction_voucherCodeId_idx" ON "Transaction"("voucherCodeId");

-- CreateIndex
CREATE INDEX "VoucherCode_currentOwnerId_isUsed_idx" ON "VoucherCode"("currentOwnerId", "isUsed");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_voucherCodeId_fkey" FOREIGN KEY ("voucherCodeId") REFERENCES "VoucherCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherCode" ADD CONSTRAINT "VoucherCode_currentOwnerId_fkey" FOREIGN KEY ("currentOwnerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
