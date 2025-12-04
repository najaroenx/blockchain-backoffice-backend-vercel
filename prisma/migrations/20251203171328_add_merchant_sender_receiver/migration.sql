-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "merchantSenderId" TEXT,
ADD COLUMN "merchantReceiverId" TEXT;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_merchantSenderId_fkey" FOREIGN KEY ("merchantSenderId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_merchantReceiverId_fkey" FOREIGN KEY ("merchantReceiverId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
