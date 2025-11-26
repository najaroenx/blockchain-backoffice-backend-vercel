-- AlterTable
ALTER TABLE "Voucher" ADD COLUMN IF NOT EXISTS "listingId" TEXT,
ADD COLUMN IF NOT EXISTS "onChainTypeId" TEXT;

-- CreateTable (skip if already exists from previous migration)
CREATE TABLE IF NOT EXISTS "TempLinkCreateUser" (
    "id" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "expire" TIMESTAMP(3) NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TempLinkCreateUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (skip if already exists)
CREATE UNIQUE INDEX IF NOT EXISTS "TempLinkCreateUser_uid_key" ON "TempLinkCreateUser"("uid");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TempLinkCreateUser_uid_idx" ON "TempLinkCreateUser"("uid");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TempLinkCreateUser_phoneNumber_idx" ON "TempLinkCreateUser"("phoneNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TempLinkCreateUser_merchantId_idx" ON "TempLinkCreateUser"("merchantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TempLinkCreateUser_expire_idx" ON "TempLinkCreateUser"("expire");
