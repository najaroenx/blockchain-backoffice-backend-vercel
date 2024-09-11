/*
  Warnings:

  - You are about to drop the column `lineOfficialId` on the `Merchant` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Merchant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "website" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_Merchant" ("created_at", "id", "name", "updated_at", "website") SELECT "created_at", "id", "name", "updated_at", "website" FROM "Merchant";
DROP TABLE "Merchant";
ALTER TABLE "new_Merchant" RENAME TO "Merchant";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
