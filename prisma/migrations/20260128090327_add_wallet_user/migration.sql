/*
  Warnings:

  - A unique constraint covering the columns `[wallet_address]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[public_key]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[phone_number]` on the table `User` will be added. If there are existing duplicate values, this will fail.
*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "nonce" TEXT,
ADD COLUMN     "nonce_created_at" TIMESTAMP(3),
ADD COLUMN     "phone_number" TEXT,
ADD COLUMN     "public_key" TEXT,
ADD COLUMN     "wallet_address" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_wallet_address_key" ON "User"("wallet_address");

-- CreateIndex
CREATE UNIQUE INDEX "User_public_key_key" ON "User"("public_key");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_number_key" ON "User"("phone_number");
