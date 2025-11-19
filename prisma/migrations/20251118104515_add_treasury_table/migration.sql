-- CreateTable
CREATE TABLE "Treasury" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Treasury_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Treasury_walletAddress_key" ON "Treasury"("walletAddress");

-- CreateIndex
CREATE INDEX "Treasury_type_idx" ON "Treasury"("type");
