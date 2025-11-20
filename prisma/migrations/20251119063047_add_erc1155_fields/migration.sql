-- AlterTable
ALTER TABLE "Voucher" ADD COLUMN     "listingId" TEXT,
ADD COLUMN     "onChainTypeId" TEXT;

-- CreateTable
CREATE TABLE "TempLinkCreateUser" (
    "id" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "expire" TIMESTAMP(3) NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TempLinkCreateUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TempLinkCreateUser_uid_key" ON "TempLinkCreateUser"("uid");

-- CreateIndex
CREATE INDEX "TempLinkCreateUser_uid_idx" ON "TempLinkCreateUser"("uid");

-- CreateIndex
CREATE INDEX "TempLinkCreateUser_phoneNumber_idx" ON "TempLinkCreateUser"("phoneNumber");

-- CreateIndex
CREATE INDEX "TempLinkCreateUser_merchantId_idx" ON "TempLinkCreateUser"("merchantId");

-- CreateIndex
CREATE INDEX "TempLinkCreateUser_expire_idx" ON "TempLinkCreateUser"("expire");
