-- CreateEnum
CREATE TYPE "ParticipantType" AS ENUM ('CUSTOMER', 'MERCHANT', 'SYSTEM');

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "senderType" "ParticipantType";
ALTER TABLE "Transaction" ADD COLUMN "receiverType" "ParticipantType";
ALTER TABLE "Transaction" ADD COLUMN "merchantRef" TEXT;

-- CreateIndex
CREATE INDEX "Transaction_senderType_idx" ON "Transaction"("senderType");
CREATE INDEX "Transaction_receiverType_idx" ON "Transaction"("receiverType");
