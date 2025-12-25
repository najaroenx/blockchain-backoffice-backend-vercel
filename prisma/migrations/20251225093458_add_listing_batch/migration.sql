-- CreateEnum
CREATE TYPE "ListingBatchStatus" AS ENUM ('ACTIVE', 'SOLD_OUT', 'CANCELLED', 'EXPIRED');

-- AlterTable
ALTER TABLE "VoucherCode" ADD COLUMN     "listingBatchId" TEXT;

-- CreateTable
CREATE TABLE "ListingBatch" (
    "id" TEXT NOT NULL,
    "sellerWalletAddress" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "totalItems" INTEGER NOT NULL,
    "soldItems" INTEGER NOT NULL DEFAULT 0,
    "totalValue" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'THB',
    "status" "ListingBatchStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListingBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ListingBatch_sellerWalletAddress_idx" ON "ListingBatch"("sellerWalletAddress");

-- CreateIndex
CREATE INDEX "ListingBatch_status_idx" ON "ListingBatch"("status");

-- CreateIndex
CREATE INDEX "ListingBatch_created_at_idx" ON "ListingBatch"("created_at");

-- CreateIndex
CREATE INDEX "VoucherCode_listingBatchId_idx" ON "VoucherCode"("listingBatchId");

-- AddForeignKey
ALTER TABLE "VoucherCode" ADD CONSTRAINT "VoucherCode_listingBatchId_fkey" FOREIGN KEY ("listingBatchId") REFERENCES "ListingBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
