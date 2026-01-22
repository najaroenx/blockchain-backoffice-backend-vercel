/*
  Warnings:

  - You are about to drop the column `merchantReceiverId` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `merchantSenderId` on the `Transaction` table. All the data in the column will be lost.
  - You are about to drop the column `privateKey` on the `Wallet` table. All the data in the column will be lost.
  - Added the required column `chainCode` to the `Wallet` table without a default value. This is not possible if the table is not empty.
  - Added the required column `seedPhrase` to the `Wallet` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "CustomerMerChant" ADD COLUMN     "createdAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Transaction" DROP COLUMN "merchantReceiverId",
DROP COLUMN "merchantSenderId";

-- AlterTable
ALTER TABLE "Wallet" DROP COLUMN "privateKey",
ADD COLUMN     "chainCode" TEXT NOT NULL,
ADD COLUMN     "derivationIndex" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "seedPhrase" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "Transaction_senderId_idx" ON "Transaction"("senderId");

-- CreateIndex
CREATE INDEX "Transaction_receiverId_idx" ON "Transaction"("receiverId");
