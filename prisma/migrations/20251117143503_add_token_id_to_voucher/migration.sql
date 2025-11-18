-- AlterTable
ALTER TABLE "Voucher" ADD COLUMN "tokenId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Voucher_tokenId_key" ON "Voucher"("tokenId");
