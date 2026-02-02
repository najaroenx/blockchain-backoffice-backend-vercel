-- CreateTable
CREATE TABLE "MerchantRefStore" (
    "id" TEXT NOT NULL,
    "merchantRef" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "imageUrl" TEXT,
    "locationUrl" TEXT,
    "website" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MerchantRefStore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MerchantRefStore_merchantRef_key" ON "MerchantRefStore"("merchantRef");

-- CreateIndex
CREATE INDEX "MerchantRefStore_merchantRef_idx" ON "MerchantRefStore"("merchantRef");

-- CreateIndex
CREATE INDEX "MerchantRefStore_isActive_idx" ON "MerchantRefStore"("isActive");

-- CreateIndex
CREATE INDEX "MerchantRefStore_category_idx" ON "MerchantRefStore"("category");
