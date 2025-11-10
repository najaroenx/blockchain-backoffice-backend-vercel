-- CreateEnum
CREATE TYPE "VoucherStatus" AS ENUM ('active', 'upcoming');

-- CreateEnum
CREATE TYPE "VoucherValueType" AS ENUM ('percentage', 'cash', 'gift', 'multiplier');

-- AlterTable
ALTER TABLE "Merchant" ADD COLUMN     "categories" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Point" ADD COLUMN     "slotSize" INTEGER;

-- CreateTable
CREATE TABLE "Voucher" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "VoucherStatus" NOT NULL,
    "merchantName" TEXT NOT NULL,
    "merchantId" TEXT,
    "valueType" "VoucherValueType" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "currency" TEXT,
    "pointsCost" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "totalIssued" INTEGER NOT NULL,
    "totalRedeemed" INTEGER NOT NULL,
    "imageUrl" TEXT,
    "limitPerMember" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Voucher_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
