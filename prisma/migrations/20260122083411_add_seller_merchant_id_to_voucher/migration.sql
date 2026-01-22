-- AlterTable
ALTER TABLE "Voucher" ADD COLUMN     "sellerMerchantId" TEXT;

-- CreateIndex
CREATE INDEX "Voucher_sellerMerchantId_idx" ON "Voucher"("sellerMerchantId");
