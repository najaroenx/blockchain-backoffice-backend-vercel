-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "eventId" TEXT;

-- CreateIndex
CREATE INDEX "Transaction_eventId_idx" ON "Transaction"("eventId");
