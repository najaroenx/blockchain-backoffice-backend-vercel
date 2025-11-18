/*
  Warnings:

  - A unique constraint covering the columns `[customerId,pointId]` on the table `CustomerPoint` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "VoucherCode" ADD COLUMN     "currency" TEXT,
ADD COLUMN     "pointId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "CustomerPoint_customerId_pointId_key" ON "CustomerPoint"("customerId", "pointId");

-- CreateIndex
CREATE INDEX "VoucherCode_pointId_idx" ON "VoucherCode"("pointId");

-- AddForeignKey
ALTER TABLE "VoucherCode" ADD CONSTRAINT "VoucherCode_pointId_fkey" FOREIGN KEY ("pointId") REFERENCES "Point"("id") ON DELETE SET NULL ON UPDATE CASCADE;
