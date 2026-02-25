-- CreateTable
CREATE TABLE "AisTransferLog" (
    "id" TEXT NOT NULL,
    "transactionID" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "requestBody" BYTEA NOT NULL,
    "responseBody" BYTEA,
    "httpStatus" INTEGER,
    "success" BOOLEAN NOT NULL,
    "errorMessage" TEXT,
    "msisdn" TEXT NOT NULL,
    "points" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AisTransferLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AisTransferLog_transactionID_idx" ON "AisTransferLog"("transactionID");

-- CreateIndex
CREATE INDEX "AisTransferLog_msisdn_idx" ON "AisTransferLog"("msisdn");

-- CreateIndex
CREATE INDEX "AisTransferLog_action_idx" ON "AisTransferLog"("action");

-- CreateIndex
CREATE INDEX "AisTransferLog_created_at_idx" ON "AisTransferLog"("created_at");
