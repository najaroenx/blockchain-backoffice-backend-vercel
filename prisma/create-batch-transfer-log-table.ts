/**
 * Standalone TypeScript script to create the "BatchTransferLog" table.
 * Compiled by tsc inside the Docker build process and run via Docker on Staging.
 * 
 * Run command example (inside Docker container):
 *   docker exec -it <container_name_or_id> node dist/prisma/create-batch-transfer-log-table.js
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting "BatchTransferLog" table creation on database...');

  // 1. Create table query
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS "BatchTransferLog" (
        "id" TEXT NOT NULL,
        "merchantId" TEXT NOT NULL,
        "fileName" TEXT NOT NULL,
        "totalRecords" INTEGER NOT NULL,
        "successfulCount" INTEGER NOT NULL,
        "failedCount" INTEGER NOT NULL,
        "status" TEXT NOT NULL,
        "details" JSONB,
        "technicalLogs" TEXT,
        "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) NOT NULL,

        CONSTRAINT "BatchTransferLog_pkey" PRIMARY KEY ("id")
    );
  `;

  // 2. Create indices queries
  const createIndicesQueries = [
    'CREATE INDEX IF NOT EXISTS "BatchTransferLog_merchantId_idx" ON "BatchTransferLog"("merchantId");',
    'CREATE INDEX IF NOT EXISTS "BatchTransferLog_created_at_idx" ON "BatchTransferLog"("created_at");'
  ];

  // 3. Add Foreign Key if NOT exists
  const addForeignKeyQuery = `
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 
            FROM information_schema.table_constraints 
            WHERE constraint_name = 'BatchTransferLog_merchantId_fkey' 
              AND table_name = 'BatchTransferLog'
        ) THEN
            ALTER TABLE "BatchTransferLog" 
            ADD CONSTRAINT "BatchTransferLog_merchantId_fkey" 
            FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") 
            ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
    END $$;
  `;

  try {
    console.log('-> Creating table (if not exists)...');
    await prisma.$executeRawUnsafe(createTableQuery);

    console.log('-> Creating indexes...');
    for (const indexQuery of createIndicesQueries) {
      await prisma.$executeRawUnsafe(indexQuery);
    }

    console.log('-> Attaching foreign key reference back to Merchant...');
    await prisma.$executeRawUnsafe(addForeignKeyQuery);

    console.log('✅ "BatchTransferLog" Table and components created successfully!');
  } catch (error) {
    console.error('❌ Database installation failed:', error);
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error('Unexpected error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
