-- AlterEnum
ALTER TYPE "ParticipantType" ADD VALUE 'SELLER';

-- DropForeignKey
ALTER TABLE "VoucherCode" DROP CONSTRAINT "VoucherCode_currentOwnerId_fkey";

-- DropIndex
DROP INDEX "VoucherCode_currentOwnerId_isUsed_idx";

-- AlterTable
ALTER TABLE "VoucherCode" ADD COLUMN     "currentOwnerType" "ParticipantType";

-- CreateIndex
CREATE INDEX "VoucherCode_currentOwnerId_currentOwnerType_idx" ON "VoucherCode"("currentOwnerId", "currentOwnerType");
