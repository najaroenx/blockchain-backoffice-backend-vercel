-- Migrate old lowercase transaction types to new uppercase ones
-- This migration updates existing transactions to use the new enum format

-- Update transactions using old lowercase types
UPDATE "Transaction" 
SET "transactionTypeId" = 'REDEEM' 
WHERE "transactionTypeId" = 'redeem';

UPDATE "Transaction" 
SET "transactionTypeId" = 'TRANSFER' 
WHERE "transactionTypeId" = 'transfer';

UPDATE "Transaction" 
SET "transactionTypeId" = 'EARN' 
WHERE "transactionTypeId" = 'earn';

-- Delete old lowercase transaction types (they're no longer needed)
DELETE FROM "TransactionType" WHERE id = 'redeem';
DELETE FROM "TransactionType" WHERE id = 'transfer';
DELETE FROM "TransactionType" WHERE id = 'earn';
