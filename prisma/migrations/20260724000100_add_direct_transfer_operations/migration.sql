-- CreateEnum
CREATE TYPE "VoucherSourcePool" AS ENUM (
  'WALLET_POOL',
  'ACTIVE_MARKETPLACE_POOL'
);

-- CreateEnum
CREATE TYPE "DirectTransferOperationStatus" AS ENUM (
  'PREPARED',
  'SUBMITTED',
  'CONFIRMED',
  'CHAIN_FAILED',
  'DB_FAILED',
  'MANUAL_REVIEW'
);

-- CreateEnum
CREATE TYPE "DirectTransferRecoveryRunStatus" AS ENUM (
  'RUNNING',
  'COMPLETED',
  'PARTIAL_FAILED',
  'FAILED'
);

-- CreateEnum
CREATE TYPE "DirectTransferRecoveryActorType" AS ENUM (
  'ADMIN',
  'APPLICATION'
);

-- CreateEnum
CREATE TYPE "DirectTransferOperationAction" AS ENUM (
  'OPERATION_PREPARED',
  'TRANSACTION_SUBMITTED',
  'OPERATION_CONFIRMED',
  'RECEIPT_CHECKED',
  'DB_FINALIZED',
  'CLAIM_RELEASED',
  'MARKED_DB_FAILED',
  'MARKED_MANUAL_REVIEW',
  'NO_CHANGE',
  'ERROR'
);

-- AlterTable
ALTER TABLE "Transaction"
ADD COLUMN "sourcePool" "VoucherSourcePool";

-- CreateTable
CREATE TABLE "DirectTransferOperation" (
  "id" TEXT NOT NULL,
  "merchantId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "voucherId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "reservedVoucherCodeIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "sourcePool" "VoucherSourcePool" NOT NULL DEFAULT 'WALLET_POOL',
  "status" "DirectTransferOperationStatus" NOT NULL DEFAULT 'PREPARED',
  "txHash" TEXT,
  "errorNote" TEXT,
  "submittedAt" TIMESTAMP(3),
  "confirmedAt" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DirectTransferOperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DirectTransferRecoveryRun" (
  "id" TEXT NOT NULL,
  "status" "DirectTransferRecoveryRunStatus" NOT NULL DEFAULT 'RUNNING',
  "actorId" TEXT,
  "reason" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "inspectedCount" INTEGER NOT NULL DEFAULT 0,
  "confirmedCount" INTEGER NOT NULL DEFAULT 0,
  "releasedCount" INTEGER NOT NULL DEFAULT 0,
  "pendingCount" INTEGER NOT NULL DEFAULT 0,
  "failedCount" INTEGER NOT NULL DEFAULT 0,
  "errorNote" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DirectTransferRecoveryRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DirectTransferOperationEvent" (
  "id" TEXT NOT NULL,
  "recoveryRunId" TEXT,
  "operationId" TEXT,
  "actorType" "DirectTransferRecoveryActorType" NOT NULL,
  "actorId" TEXT,
  "action" "DirectTransferOperationAction" NOT NULL,
  "fromStatus" "DirectTransferOperationStatus",
  "toStatus" "DirectTransferOperationStatus",
  "txHash" TEXT,
  "receiptStatus" INTEGER,
  "errorNote" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DirectTransferOperationEvent_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "VoucherCode"
ADD COLUMN "directTransferOperationId" TEXT;

-- CreateIndex
CREATE INDEX "Transaction_sourcePool_idx"
ON "Transaction"("sourcePool");

-- CreateIndex
CREATE INDEX "VoucherCode_directTransferOperationId_idx"
ON "VoucherCode"("directTransferOperationId");

-- CreateIndex
CREATE INDEX "DirectTransferOperation_merchantId_status_idx"
ON "DirectTransferOperation"("merchantId", "status");

-- CreateIndex
CREATE INDEX "DirectTransferOperation_customerId_idx"
ON "DirectTransferOperation"("customerId");

-- CreateIndex
CREATE INDEX "DirectTransferOperation_voucherId_idx"
ON "DirectTransferOperation"("voucherId");

-- CreateIndex
CREATE INDEX "DirectTransferOperation_status_created_at_idx"
ON "DirectTransferOperation"("status", "created_at");

-- CreateIndex
CREATE INDEX "DirectTransferRecoveryRun_status_startedAt_idx"
ON "DirectTransferRecoveryRun"("status", "startedAt");

-- CreateIndex
CREATE INDEX "DirectTransferRecoveryRun_actorId_startedAt_idx"
ON "DirectTransferRecoveryRun"("actorId", "startedAt");

-- CreateIndex
CREATE INDEX "DirectTransferOperationEvent_recoveryRunId_idx"
ON "DirectTransferOperationEvent"("recoveryRunId");

-- CreateIndex
CREATE INDEX "DirectTransferOperationEvent_operationId_created_at_idx"
ON "DirectTransferOperationEvent"("operationId", "created_at");

-- CreateIndex
CREATE INDEX "DirectTransferOperationEvent_action_created_at_idx"
ON "DirectTransferOperationEvent"("action", "created_at");

-- AddForeignKey
ALTER TABLE "VoucherCode"
ADD CONSTRAINT "VoucherCode_directTransferOperationId_fkey"
FOREIGN KEY ("directTransferOperationId")
REFERENCES "DirectTransferOperation"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectTransferOperationEvent"
ADD CONSTRAINT "DirectTransferOperationEvent_recoveryRunId_fkey"
FOREIGN KEY ("recoveryRunId")
REFERENCES "DirectTransferRecoveryRun"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectTransferOperationEvent"
ADD CONSTRAINT "DirectTransferOperationEvent_operationId_fkey"
FOREIGN KEY ("operationId")
REFERENCES "DirectTransferOperation"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
