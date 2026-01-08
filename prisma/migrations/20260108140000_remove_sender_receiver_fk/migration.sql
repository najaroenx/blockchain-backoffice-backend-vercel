-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT IF EXISTS "Transaction_senderId_fkey";
ALTER TABLE "Transaction" DROP CONSTRAINT IF EXISTS "Transaction_receiverId_fkey";
ALTER TABLE "Transaction" DROP CONSTRAINT IF EXISTS "Transaction_merchantSenderId_fkey";
ALTER TABLE "Transaction" DROP CONSTRAINT IF EXISTS "Transaction_merchantReceiverId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "Transaction_senderId_idx";
DROP INDEX IF EXISTS "Transaction_receiverId_idx";
DROP INDEX IF EXISTS "Transaction_merchantSenderId_idx";
DROP INDEX IF EXISTS "Transaction_merchantReceiverId_idx";
