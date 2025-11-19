/*
  Warnings:

  - A unique constraint covering the columns `[type]` on the table `Treasury` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Treasury_type_idx";

-- CreateIndex
CREATE UNIQUE INDEX "Treasury_type_key" ON "Treasury"("type");
