/*
  Warnings:

  - You are about to drop the column `categories` on the `Merchant` table. All the data in the column will be lost.
  - You are about to drop the `Branch` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[walletId]` on the table `Customer` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[walletId]` on the table `Merchant` will be added. If there are existing duplicate values, this will fail.
  - Made the column `tel` on table `Customer` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `tel` to the `Merchant` table without a default value. This is not possible if the table is not empty.
  - Added the required column `redeemCode` to the `Voucher` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."Branch" DROP CONSTRAINT "Branch_merchantId_fkey";

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "walletId" TEXT,
ALTER COLUMN "tel" SET NOT NULL;

-- AlterTable
ALTER TABLE "Merchant" DROP COLUMN "categories",
ADD COLUMN     "tel" TEXT NOT NULL,
ADD COLUMN     "walletId" TEXT;

-- AlterTable
ALTER TABLE "Voucher" ADD COLUMN     "redeemCode" TEXT NOT NULL;

-- DropTable
DROP TABLE "public"."Branch";

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "privateKey" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Customer_walletId_key" ON "Customer"("walletId");

-- CreateIndex
CREATE UNIQUE INDEX "Merchant_walletId_key" ON "Merchant"("walletId");

-- AddForeignKey
ALTER TABLE "Merchant" ADD CONSTRAINT "Merchant_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
