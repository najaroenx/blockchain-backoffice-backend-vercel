/*
  Warnings:

  - You are about to drop the column `frameSize` on the `Point` table. All the data in the column will be lost.
  - You are about to drop the column `slotSize` on the `Point` table. All the data in the column will be lost.
  - Added the required column `endDate` to the `Point` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "VoucherValueType" ADD VALUE 'aispoint';

-- AlterTable
ALTER TABLE "Point" DROP COLUMN "frameSize",
DROP COLUMN "slotSize",
ADD COLUMN     "endDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "epochDuration" INTEGER NOT NULL DEFAULT 259200;
