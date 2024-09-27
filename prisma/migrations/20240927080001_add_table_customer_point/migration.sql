-- CreateTable
CREATE TABLE "CustomerPoint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT,
    "pointId" TEXT,
    "balances" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "CustomerPoint_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CustomerPoint_pointId_fkey" FOREIGN KEY ("pointId") REFERENCES "Point" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
