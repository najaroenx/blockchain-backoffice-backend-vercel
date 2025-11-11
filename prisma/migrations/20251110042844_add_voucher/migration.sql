-- ================================================================
-- Safe Migration for Voucher Feature (Enums, Tables, Foreign Keys)
-- ================================================================

-- ================================================================
-- Create Enum: VoucherStatus
-- ================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'VoucherStatus') THEN
    CREATE TYPE "VoucherStatus" AS ENUM ('active', 'upcoming');
  END IF;
END $$;

-- ================================================================
-- Create Enum: VoucherValueType
-- ================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'VoucherValueType') THEN
    CREATE TYPE "VoucherValueType" AS ENUM ('percentage', 'cash', 'gift', 'multiplier');
  END IF;
END $$;

-- ================================================================
-- Create Table: Wallet
-- ================================================================
CREATE TABLE IF NOT EXISTS "Wallet" (
    "id" TEXT NOT NULL,
    "address" BYTEA NOT NULL,
    "privateKey" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- ================================================================
-- Create Table: Voucher
-- ================================================================
CREATE TABLE IF NOT EXISTS "Voucher" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "VoucherStatus" NOT NULL,
    "merchantName" TEXT NOT NULL,
    "merchantId" TEXT,
    "valueType" "VoucherValueType" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "currency" TEXT,
    "pointsCost" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "totalIssued" INTEGER NOT NULL,
    "totalRedeemed" INTEGER NOT NULL,
    "imageUrl" TEXT,
    "limitPerMember" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Voucher_pkey" PRIMARY KEY ("id")
);

-- ================================================================
-- Add Foreign Key: Voucher -> Merchant
-- Safe check for existing constraint before creating new one
-- ================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'Voucher_merchantId_fkey'
  ) THEN
    ALTER TABLE "Voucher"
    ADD CONSTRAINT "Voucher_merchantId_fkey"
    FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
