-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "transactionRefId" TEXT;

-- CreateIndex
CREATE INDEX "Transaction_transactionRefId_idx" ON "Transaction"("transactionRefId");
