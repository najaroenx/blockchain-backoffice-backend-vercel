/*
  Warnings:

  - You are about to drop the column `email` on the `Transaction` table. All the data in the column will be lost.
  - Added the required column `senderAddress` to the `Transaction` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "firstName" TEXT,
    "lastName" TEXT,
    "txHash" BLOB NOT NULL,
    "senderAddress" BLOB NOT NULL,
    "receiverAddress" BLOB NOT NULL,
    "amount" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "merchantId" TEXT,
    "pointId" TEXT,
    "transactionTypeId" TEXT,
    "customerId" TEXT,
    CONSTRAINT "Transaction_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transaction_pointId_fkey" FOREIGN KEY ("pointId") REFERENCES "Point" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transaction_transactionTypeId_fkey" FOREIGN KEY ("transactionTypeId") REFERENCES "TransactionType" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transaction_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Transaction" ("amount", "created_at", "customerId", "firstName", "id", "lastName", "merchantId", "pointId", "receiverAddress", "transactionTypeId", "txHash", "updated_at") SELECT "amount", "created_at", "customerId", "firstName", "id", "lastName", "merchantId", "pointId", "receiverAddress", "transactionTypeId", "txHash", "updated_at" FROM "Transaction";
DROP TABLE "Transaction";
ALTER TABLE "new_Transaction" RENAME TO "Transaction";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
