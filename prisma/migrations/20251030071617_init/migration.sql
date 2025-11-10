-- AlterTable
ALTER TABLE "Merchant" ADD COLUMN     "description" TEXT,
ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "location" TEXT,
ADD COLUMN     "points" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "voucherIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
