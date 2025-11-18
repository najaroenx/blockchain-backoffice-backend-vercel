/*
  Warnings:

  - You are about to drop the column `privateKey` on the `Customer` table. All the data in the column will be lost.
  - You are about to drop the column `walletAddress` on the `Customer` table. All the data in the column will be lost.
  - Added the required column `walletAddress` to the `Wallet` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Customer_tel_key";

-- AlterTable
ALTER TABLE "Customer" DROP COLUMN "privateKey",
DROP COLUMN "walletAddress";

-- AlterTable
ALTER TABLE "Wallet" ADD COLUMN     "walletAddress" TEXT NOT NULL;
