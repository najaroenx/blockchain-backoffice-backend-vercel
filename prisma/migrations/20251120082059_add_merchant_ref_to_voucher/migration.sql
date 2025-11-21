/*
  Warnings:

  - You are about to drop the column `listingId` on the `Voucher` table. All the data in the column will be lost.
  - You are about to drop the column `onChainTypeId` on the `Voucher` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Voucher" DROP COLUMN "listingId",
DROP COLUMN "onChainTypeId",
ADD COLUMN     "merchantRef" TEXT;
